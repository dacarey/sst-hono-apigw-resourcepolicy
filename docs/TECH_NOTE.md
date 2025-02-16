# Technical Note

## Overview

This note explains the differences and common similarities between calling a REST API implemented via AWS API Gateway versus using a Lambda Function URL, focusing on the availability of authentication and authorization information—specifically the inclusion of `aws:PrincipalOrgID` in the request context for signed AWS API requests.

## AWS API Gateway

- **Authentication & Authorization:**  
  - API Gateway supports IAM authorization. When a request is signed using SigV4, API Gateway validates the signature and extracts detailed IAM principal information.
  - It automatically integrates with resource policies. For example, when a resource policy includes a condition on `"aws:PrincipalOrgID"`, API Gateway evaluates this condition based on the enriched identity details derived from the caller’s signature.
  
- **Request Context Enrichment:**  
  - The API Gateway request context is enriched with metadata such as the caller's ARN and other identity details.
  - Crucially, when using IAM authorization, API Gateway can infer and utilize the `aws:PrincipalOrgID` value internally for policy evaluation, even though it might not explicitly list this key in the event data passed to the backend integration. The resource policy evaluation itself, however, is handled by API Gateway before forwarding the request.

## Lambda Function URL

- **Authentication & Authorization:**  
  - Lambda Function URLs also support SigV4-signed requests, and they validate the signature to authenticate the caller.
  - They do not automatically enforce or evaluate resource policies like API Gateway does. There is no native support for conditions such as `"aws:PrincipalOrgID"`.
  
- **Request Context:**  
  - The Lambda event contains a simpler `requestContext` object. This object lacks the enriched identity data (including the inferred `aws:PrincipalOrgID`) that API Gateway computes.
  - To retrieve details about the caller’s identity, including their AWS account and assumed role information, you must explicitly call the AWS STS API (e.g., using `GetCallerIdentity`). There is no automatic mechanism to include organization-related context within the Lambda Function URL request context.

## Common Similarities

- **Request Signing:**  
  - Both API Gateway and Lambda Function URLs support AWS SigV4 for request signing. The signing process ensures that the request is authenticated.
  - Temporary credentials (e.g., provided via `x-amz-security-token`) may be used in both cases, indicating that temporary or assumed-role credentials are in effect.
  
- **Retrieving Caller Identity:**  
  - In both scenarios, you can validate and inspect the caller’s credentials using AWS STS (via the `GetCallerIdentity` API). However, the automatic enrichment of the request (as seen in API Gateway) does not occur for Lambda Function URLs.

## Conclusion

While both API Gateway and Lambda Function URLs support SigV4 authentication, API Gateway provides a richer integration with IAM and resource policies. API Gateway automatically enriches the request context and can evaluate conditions such as `"aws:PrincipalOrgID"` when enforcing resource policies. In contrast, Lambda Function URLs require manual intervention to retrieve and process caller identity details, and they lack the built-in mechanism for authorizing requests based on organization-related data. This difference is a key consideration when deciding which integration to use for applications requiring detailed authorization controls.