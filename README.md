# Reference API Gateway to test Custom Resource Policy

This project demonstrates how to configure an API Gateway using SST with a custom resource policy that only applies when allowed AWS account IDs are provided. It also shows how to run the API in both production and development modes, troubleshoot authorization issues, and test access using tools that support AWS profiles.

## Table of Contents

-   [Configuration](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#configuration)
-   [Deployment](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#deployment)
    -   [Standard Deployment](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#standard-deployment)
    -   [Development Mode](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#development-mode)
-   [Troubleshooting](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#troubleshooting)
-   [Testing](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#testing)

## Configuration

The API resource policy is applied conditionally based on environment variables. You can supply allowed account IDs in two ways:

1.  **Using a JSON File**  
    Set the environment variable `ALLOWED_ACCOUNTS_FILE` to point to a JSON file containing an array of account IDs:
    
    ```json
    ["111111111111", "222222222222"]
    
    ```
    
2.  **Using a Comma-Separated String**  
    Alternatively, set `ALLOWED_ACCOUNTS` as a comma-separated list:
    
    ```bash
    export ALLOWED_ACCOUNTS="111111111111,222222222222"
    
    ```
    

If neither is provided (or the list is empty), no custom resource policy will be injected into the API.

## Deployment

### Standard Deployment

To deploy your API with SST, simply run:

```bash
npx sst deploy

```

This command deploys your infrastructure to AWS using your current SST configuration.

### Development Mode

For live testing and rapid development, run SST in dev mode. This mode executes your function live so you see changes immediately:

```bash
npx sst dev

```

While in dev mode, any changes to your code or configuration will update automatically.

## Troubleshooting

If your REST API is not authorizing requests correctly, try the following:

1.  **Verify Environment Variables:**  
    Ensure that `ALLOWED_ACCOUNTS` or `ALLOWED_ACCOUNTS_FILE` is correctly set and contains the expected AWS account IDs.
    
2.  **Check API Gateway Logs in CloudWatch:**
    
    -   Log in to the AWS Console and open **CloudWatch**.
    -   Navigate to **Logs** and search for the log group (for example, `/aws/vendedlogs/apis/<your-api-name>`).
    -   Look for error messages such as 401 (Unauthorized) or 403 (Forbidden) to determine why a request was blocked.
3.  **Common Issues:**
    
    -   **401 Unauthorized:** Indicates missing or invalid credentials.
    -   **403 Forbidden:** Often a result of the request originating from an AWS account not included in the allowed list. Use the CloudWatch logs for more details.

## Testing
For a convenient testing experience, you can use tools like [awscurl](https://github.com/okigan/awscurl) which support signing requests with your AWS credentials using the `--profile` flag. This approach allows you to easily simulate API calls from different AWS accounts. 

You can also use AWS CloudShell, which provides a browser-based shell with pre-authenticated credentials matching your current AWS Console session. CloudShell comes with common tools like `curl` pre-installed, making it easy to test API calls without local setup, though you'll be limited to testing with your current account's permissions.

### Installing awscurl

If you don’t already have awscurl installed, you can install it via the uv package manager:

```bash
uv tool install awscurl

```

### Example Testing Commands

Assume you have two AWS CLI profiles set up:

-   `awsaccountDOEShaveaccess` – an account that is allowed to access the API.
-   `awsaccountDOESNOThaveaccess` – an account that is not allowed.

#### Testing with a Profile That Has Access

Run a GET request using the allowed profile:

```bash
awscurl --profile awsaccountDOEShaveaccess https://your-api.execute-api.YOUR_REGION.amazonaws.com/your_stage/

```

This should return a successful response.

#### Testing with a Profile That Lacks Access

Run a similar request with the profile that should be denied:

```bash
awscurl --profile awsaccountDOESNOThaveaccess https://your-api.execute-api.YOUR_REGION.amazonaws.com/your_stage/

```

In this case, you should see a **401 Unauthorized** or **403 Forbidden** response. If AWS hides the error details, refer to your CloudWatch logs (see [Troubleshooting](https://chatgpt.com/c/67a37c4b-0480-8012-9b6b-3c8f34d088eb#troubleshooting)) for more insights.