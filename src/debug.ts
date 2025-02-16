import { Hono, Context } from 'hono'
import { handle } from 'hono/aws-lambda'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import type { LambdaEvent } from 'hono/aws-lambda'

type Bindings = {
  event: LambdaEvent
}

// Create the STSClient once for reuse across requests
const stsClient = new STSClient({})

// Initialize the Hono app with typed bindings
const app = new Hono<{ Bindings: Bindings }>()

/**
 * GET /debug
 * Logs request details including the Lambda requestContext and retrieves AWS caller identity using STS.
 */
app.get('/debug', async (c: Context) => {
  console.log('Received request:', {
    headers: c.req.header(),
    url: c.req.url,
    method: c.req.method,
    requestContext: c.env.event.requestContext
  })

  try {
    const command = new GetCallerIdentityCommand({})
    const callerIdentity = await stsClient.send(command)
    console.log('Caller Identity:', callerIdentity)
    return c.json({
      message: 'Lambda executed successfully. Check CloudWatch logs for caller identity details.',
      callerIdentity
    })
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Error retrieving caller identity:', errorMsg, error instanceof Error ? error.stack : '')
    return c.json({ message: 'Error retrieving caller identity', error: errorMsg }, 500)
  }
})

export const handler = handle(app)
