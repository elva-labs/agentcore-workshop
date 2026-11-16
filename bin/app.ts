import { App } from 'aws-cdk-lib';
import { AgentStack } from '../lib/agent-stack';

const app = new App();
const stage: unknown = app.node.tryGetContext('stage');
if (typeof stage !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(stage)) {
  throw new Error('Provide a unique stage with -c stage=your-name (1–40 lowercase letters, digits or hyphens; start with a letter).');
}

new AgentStack(app, `AgentCoreBot-${stage}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-north-1',
  },
});
