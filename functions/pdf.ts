import middy from "@middy/core";
import chromium from "chrome-aws-lambda";
import AWS from "aws-sdk";
import { APIGatewayEvent } from "aws-lambda";
import doNotWaitForEmptyEventLoop from "@middy/do-not-wait-for-empty-event-loop";

const Bucket = "html-pdf-0506-917";
const Key = `sample.pdf`;

async function putObject(stream: any): Promise<boolean> {
  const s3 = new AWS.S3();

  const params: AWS.S3.PutObjectRequest = {
    Bucket,
    Key,
    Body: stream,
    Expires: new Date(2021, 3, 3),
  };

  return new Promise((res, rej) => {
    s3.putObject(params, (err: AWS.AWSError, data: AWS.S3.PutObjectOutput) => {
      if (err) console.log(err, err.stack);
      // an error occurred
      else console.log("Success saved", data); // successful response

      res(true);
    });
  });
}

const handler = async (event: APIGatewayEvent) => {
  const executablePath = process.env.IS_OFFLINE
    ? null
    : await chromium.executablePath;

  let body = null;
  if (event.body && event.body) {
    body = event.body;
  } else {
    return {
      statusCode: 400,
      headers: {
        "Content-type": "application/json",
      },
    };
  }

  const browser = await chromium.puppeteer.launch({
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
  });

  const page = await browser.newPage();
  await page.setContent(body);
  const stream: any = await page.pdf({
    format: "A5",
  });

  const s3 = new AWS.S3();
  const getSignedUrlParams: any = {
    Bucket,
    Key,
    Expires: 360000,
  };

  await putObject(stream);

  console.log("Object saved");

  const pdfUrl = await s3.getSignedUrlPromise("getObject", getSignedUrlParams);

  console.log("PdfUrl", pdfUrl);

  return {
    statusCode: 200,
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({ url: pdfUrl }),
  };
};

export const generate = middy(handler).use(doNotWaitForEmptyEventLoop());
