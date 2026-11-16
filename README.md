# AgentCore Weather Bot

A TypeScript CDK application using AgentCore Managed Harness and Claude Sonnet 5.5 with EU inference. The harness manages the agent loop; no custom runtime application or container is required.

## Architecture

- **Managed Harness:** model configuration, instructions, and tool access.
- **AgentCore Gateway:** IAM-authenticated access to the weather Lambda.
- **Weather Lambda:** accepts a location and time and returns randomly generated mock weather, not a real forecast.
- **IAM and CloudWatch:** execution permissions and a weather Lambda log group with one-week retention.

The Lambda uses Node.js 26 on ARM64. Node.js 26 is currently a Lambda preview runtime.

## Requirements

- Node.js 26 and pnpm.
- AWS credentials for the target account.
- Access to `eu.anthropic.claude-sonnet-5-5` in `eu-north-1`.
- Permission to deploy the CDK resources and use the account's CDK bootstrap roles.

## Install

```sh
pnpm install
```

## Deploy

Provide a unique stage: 1–40 lowercase letters, digits, or hyphens, starting with a letter.

```sh
pnpm bootstrap -c stage=your-name
pnpm run deploy -c stage=your-name
```

Bootstrap is needed once per account and region, unless it is already configured. The default region is `eu-north-1`.

The stack is named `AgentCoreBot-<stage>`. Use the same stage for updates. Different stages get separate resources; using an existing stage updates that stack. Stage naming is not an IAM security boundary.

Deployment outputs include `HarnessId`, `HarnessArn`, and `WeatherFunctionName`.

## Invoke

In the AWS console, select the deployment region and open **Amazon Bedrock AgentCore → Agents → Harness playground**. Select the harness using the `HarnessId` output.

The bot supports general conversation and weather questions, such as:

> What is the weather in Stockholm tomorrow afternoon?

For terminal access, use the [AgentCore CLI](https://github.com/aws/agentcore-cli):

```sh
agentcore harness invoke --id <HarnessId> --session-id "$(uuidgen)" --prompt 'Hello!'
```

Invocation requires AWS authentication; this application does not deploy a public chat UI.

## Local commands

```sh
pnpm run check
pnpm run synth -c stage=your-name
```

## Remove

```sh
pnpm run destroy -c stage=your-name
```

The weather Lambda log group is deleted with the stack.
