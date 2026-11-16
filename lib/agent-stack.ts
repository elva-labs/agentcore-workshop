import { join } from 'node:path';
import { CfnOutput, Duration, Names, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class AgentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const weather = new NodejsFunction(this, 'WeatherTool', {
      entry: join(__dirname, '../tools/forecast.ts'),
      depsLockFilePath: join(__dirname, '../pnpm-lock.yaml'),
      handler: 'handler',
      runtime: new lambda.Runtime('nodejs26.x', lambda.RuntimeFamily.NODEJS),
      architecture: lambda.Architecture.ARM_64,
      bundling: { target: 'node26' },
      timeout: Duration.seconds(10),
      memorySize: 128,
      logGroup: new logs.LogGroup(this, 'WeatherToolLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    const gateway = new agentcore.Gateway(this, 'WeatherGateway', {
      authorizerConfiguration: agentcore.GatewayAuthorizer.usingAwsIam(),
      protocolConfiguration: new agentcore.McpProtocolConfiguration({
        instructions: 'Provides randomized mock weather, not real forecasts.',
      }),
    });
    const target = gateway.addLambdaTarget('WeatherTarget', {
      lambdaFunction: weather,
      toolSchema: agentcore.ToolSchema.fromInline([{
        name: 'get_weather',
        description: 'Generate random MOCK weather for a location and requested time. Never real weather.',
        inputSchema: {
          type: agentcore.SchemaDefinitionType.OBJECT,
          properties: {
            city: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'City or place, for example Stockholm, Sweden.',
            },
            time: {
              type: agentcore.SchemaDefinitionType.STRING,
              description: 'Requested time, for example 2026-11-01T12:00:00+01:00 or tomorrow afternoon.',
            },
          },
          required: ['city', 'time'],
        },
      }]),
    });

    const modelId = 'anthropic.claude-sonnet-5-5';
    const inferenceGeography = 'eu';
    const harnessName = Names.uniqueResourceName(this, {
      maxLength: 48,
      separator: '_',
      allowedSpecialCharacters: '-',
    }).replaceAll('-', '_');
    const executionRole = new iam.Role(this, 'HarnessExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      }),
      inlinePolicies: {
        HarnessRuntime: new iam.PolicyDocument({ statements: [
          new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: [
              `arn:${this.partition}:bedrock:${inferenceGeography}-*::foundation-model/${modelId}`,
              `arn:${this.partition}:bedrock:${this.region}:${this.account}:inference-profile/${inferenceGeography}.${modelId}`,
            ],
          }),
          new iam.PolicyStatement({
            actions: ['bedrock-agentcore:InvokeGateway'],
            resources: [gateway.gatewayArn],
          }),
          new iam.PolicyStatement({
            actions: ['ecr-public:GetAuthorizationToken', 'sts:GetServiceBearerToken'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords', 'xray:GetSamplingRules', 'xray:GetSamplingTargets'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            actions: ['logs:CreateLogGroup', 'logs:DescribeLogStreams', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: [`arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/runtimes/*`],
          }),
          new iam.PolicyStatement({
            actions: ['logs:DescribeLogGroups'],
            resources: [`arn:${this.partition}:logs:${this.region}:${this.account}:log-group:*`],
          }),
          new iam.PolicyStatement({
            actions: ['logs:PutResourcePolicy'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
            conditions: { StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' } },
          }),
          new iam.PolicyStatement({
            actions: ['bedrock-agentcore:GetWorkloadAccessToken', 'bedrock-agentcore:GetWorkloadAccessTokenForJWT'],
            resources: [
              `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default`,
              `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default/workload-identity/harness_${harnessName}-*`,
            ],
          }),
        ] }),
      },
    });

    const harness = new agentcore.CfnHarness(this, 'Harness', {
      harnessName,
      executionRoleArn: executionRole.roleArn,
      model: { bedrockModelConfig: { modelId: `${inferenceGeography}.${modelId}` } },
      memory: { disabled: {} },
      maxIterations: 4,
      maxTokens: 1024,
      timeoutSeconds: 60,
      systemPrompt: [{ text: [
        'You are a helpful assistant. Keep answers clear and concise.',
        'Use the available tools when needed. For weather questions, use get_weather.',
        'Ask for location and time if either is missing from a weather request.',
        'Clearly label weather results as randomly generated mock data, not real forecasts.',
      ].join(' ') }],
      tools: [{
        type: 'agentcore_gateway',
        name: 'tools',
        config: { agentCoreGateway: { gatewayArn: gateway.gatewayArn } },
      }],
      allowedTools: ['@weather'],
    });
    harness.node.addDependency(target);

    new CfnOutput(this, 'HarnessArn', { value: harness.attrArn });
    new CfnOutput(this, 'HarnessId', { value: harness.attrHarnessId });
    new CfnOutput(this, 'WeatherFunctionName', { value: weather.functionName });
  }
}
