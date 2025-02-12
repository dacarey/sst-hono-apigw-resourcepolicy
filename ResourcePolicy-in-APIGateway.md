# Technical Note: Restricting API Gateway Access Using `aws:PrincipalOrgID` in a Resource Policy

## 1. Solution Overview
To enhance the security of our AWS API Gateway while maintaining our existing custom Lambda authorizer, we are introducing an additional layer of access control using an AWS API Gateway resource policy. This policy ensures that only AWS accounts within our AWS Organization can invoke the API.

We prefer to use `aws:PrincipalOrgID` because it automatically validates that the requester belongs to our AWS Organization. In contrast, conditions like `aws:SourceAccount` and `aws:SourceArn` are designed for service-to-service requests and are not included in direct API calls via curl, awscurl, or Lambda. As a result, they would not work effectively for our scenario.

### Key Aspects of the Solution
- AWS Signature Version 4 (SigV4) is required for API calls:  
  Requests to the API must be signed using IAM credentials, preventing unauthorized public access.
- API Gateway automatically validates `aws:PrincipalOrgID`:  
  This ensures that the calling IAM entity belongs to an account within our AWS Organization.
- No hardcoded credentials are required in Lambda:  
  AWS Lambda automatically retrieves temporary IAM credentials and signs the request.
- Public unauthenticated requests will be rejected:  
  Requests that are not signed with IAM credentials will not include `aws:PrincipalOrgID`, leading to automatic rejection.

---

## 2. API Gateway Resource Policy
The following API Gateway resource policy allows only IAM-authenticated requests from AWS accounts within our Organization:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowOnlyOrgAccounts",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "execute-api:Invoke",
            "Resource": "arn:aws:execute-api:us-east-1:123456789012:abcdef1234/*",
            "Condition": {
                "StringEquals": {
                    "aws:PrincipalOrgID": "o-xxxxxxxxxx"
                }
            }
        }
    ]
}
```

### How It Works
- ✅ Allows API calls only from IAM-authenticated entities that belong to our AWS Organization (o-xxxxxxxxxx).
- ❌ Denies unauthenticated requests (e.g., public curl requests).
- ❌ Denies requests from AWS accounts outside the organization.

---

## 3. Example: AWS Lambda Function Calling API Gateway (Using `got`)
The following Node.js Lambda function calls the protected API Gateway with a signed request.

### Lambda Function
```javascript
const got = require('got');
const AWS = require('aws-sdk');
const aws4 = require('aws4');

const API_HOST = "your-api-id.execute-api.us-east-1.amazonaws.com";
const API_PATH = "/your-endpoint";
const API_REGION = "us-east-1";

async function callApiGateway() {
    // Get temporary IAM credentials from Lambda's execution role
    const credentials = await new AWS.CredentialProviderChain().resolvePromise();

    // Sign the request with AWS SigV4
    const requestOptions = {
        host: API_HOST,
        path: API_PATH,
        service: "execute-api",
        region: API_REGION,
        method: "GET",
        headers: { "Content-Type": "application/json" }
    };
    aws4.sign(requestOptions, credentials);

    // Make the API call using got
    const response = await got(`https://${API_HOST}${API_PATH}`, {
        method: requestOptions.method,
        headers: requestOptions.headers
    });

    console.log("API Response:", response.body);
}

callApiGateway();
```

### How Does This Work Without Explicit IAM Keys?
- Lambda automatically retrieves temporary IAM credentials associated with its execution role.
- The `aws4` library signs the request using these credentials.
- No hardcoded keys are needed, since AWS securely injects the credentials.

### How Does API Gateway Validate the Request?
- API Gateway forwards the IAM credentials to AWS Security Token Service (STS) for verification.
- STS determines the IAM principal's AWS Account ID.
- AWS checks if the account belongs to an Organization and automatically attaches `aws:PrincipalOrgID` to the request.
- API Gateway enforces the resource policy:
  - ✅ If `aws:PrincipalOrgID` matches → Request proceeds.
  - ❌ If `aws:PrincipalOrgID` is missing or incorrect → Request is denied.

---

## 4. Expected Behavior in Different Scenarios
### Scenario 1: Public `curl` Request
#### Command:
```sh
curl -X GET "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/your-endpoint"
```
#### Will the request be authorized?
❌ No.  
- The request is unauthenticated, so it does not include IAM credentials.
- API Gateway cannot determine an `aws:PrincipalOrgID`.
- The resource policy denies the request.

---

### Scenario 2: Using `awscurl` with an AWS CLI Profile
#### Command:
```sh
awscurl -X GET --profile my-aws-profile "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/your-endpoint"
```
#### Will the request be authorized?
✅ Yes, if the AWS profile is from an account within the Organization.  
❌ No, if the AWS profile is from an account outside the Organization.

---

### Scenario 3: Lambda Calling API Gateway (Using `got`)
#### Will the request be authorized?
✅ Yes, if Lambda runs under an IAM role from an account within the Organization.  
❌ No, if the Lambda function runs in an account outside the Organization.

---

## 5. Summary of Authorization Behavior
| Scenario | Uses IAM Auth (SigV4)? | Includes `aws:PrincipalOrgID`? | Authorized? |
|----------|------------------------|---------------------------------|-------------|
| Public cURL request | ❌ No | ❌ No | ❌ Denied |
| AWS CLI Profile via `awscurl` | ✅ Yes | ✅ Yes (if org account) | ✅ Allowed (if org) |
| Lambda calling API Gateway (`got`) | ✅ Yes | ✅ Yes (if org account) | ✅ Allowed (if org) |

---

## 6. Key Takeaways
- Only IAM-authenticated requests are allowed: Requests must be signed with AWS SigV4.
- `aws:PrincipalOrgID` is inferred by AWS: API Gateway validates the IAM credentials and determines the AWS Organization ID automatically.
- Public and unauthenticated requests are denied: If there are no IAM credentials, the request will not contain `aws:PrincipalOrgID`, and API Gateway will reject it.
- Lambda and `awscurl` (with IAM credentials) can be used to invoke the API: As long as the caller’s AWS account belongs to the Organization, the request is allowed.


