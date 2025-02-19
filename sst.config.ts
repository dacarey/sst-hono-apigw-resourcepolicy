/// <reference path="./.sst/platform/config.d.ts" />
import * as fs from "fs";
// Ensure you have "@pulumi/aws" installed in your project.
import * as aws from "@pulumi/aws";

// Define the ResourcePolicy type.
interface ResourcePolicy {
  Version: string;
  Statement: Array<{
    Sid: string;
    Effect: string;
    Principal: string;
    Action: string;
    Resource: string;
    Condition: {
      "ForAnyValue:StringEquals": {
        "aws:PrincipalOrgID": string[];
      };
    };
  }>;
}

export default $config({
  app(input) {
    return {
      name: "sst-hono-apigw-resourcepolicy",
      removal: input.stage === "production" ? "retain" : "remove",
      protect: input.stage === "production",
      home: "aws",
      providers: {
        aws: { profile: "dev-sandbox" }
      }
    };
  },
  async run() {
    new sst.aws.Function("HonoVanillaLambda", {
      url: true,
      handler: "src/index.handler",
    });
    // New DebugLambda function for troubleshooting
    new sst.aws.Function("HonoDebugLambda", {
      url: false,
      handler: "src/debug.handler",
    });

    // Read allowed accounts from environment variables.
    // Either use ALLOWED_ACCOUNTS_FILE (a JSON file with an array) or ALLOWED_ACCOUNTS (a comma-separated string).
    let allowedAccounts: string[] = [];
    if (process.env.ALLOWED_ACCOUNTS_FILE) {
      try {
        const data = fs.readFileSync(process.env.ALLOWED_ACCOUNTS_FILE, "utf-8");
        allowedAccounts = JSON.parse(data);
        if (!Array.isArray(allowedAccounts)) {
          throw new Error("The ALLOWED_ACCOUNTS_FILE must contain a JSON array of account IDs.");
        }
      } catch (error) {
        console.error("Error reading ALLOWED_ACCOUNTS_FILE:", error);
        process.exit(1);
      }
    } else if (process.env.ALLOWED_ACCOUNTS) {
      allowedAccounts = process.env.ALLOWED_ACCOUNTS.split(",").map(s => s.trim());
    }

    // Build the resource policy if allowed account IDs are provided.
    let policy: ResourcePolicy | undefined;
    if (allowedAccounts.length > 0) {
      policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowAccessForAllowedAccounts",
            Effect: "Allow",
            Principal: "*",
            Action: "execute-api:Invoke",
            Resource: "*", // Optionally, scope this to your API ARN.
            Condition: {
              "ForAnyValue:StringEquals": {
                "aws:PrincipalOrgID": allowedAccounts
              }
            }
          }
        ]
      };
    }

    // Create the API and use a transform to inject the resource policy.
    const api = new sst.aws.ApiGatewayV1("MyApi", {
      transform: {
        api: (
          args: aws.apigateway.RestApiArgs,
          opts: any,
          name: string
        ): undefined => {
          if (policy) {
            args.policy = JSON.stringify(policy);
            console.log(`Resource policy "${args.policy}" added to API "${name}".`);
          }
          // Explicitly return undefined to match the expected signature.
          return undefined;
        }
      }
    });

    api.route("GET /", "src/index.handler");
    api.route("GET /debug", "src/debug.handler");
    api.deploy();
  }
});
