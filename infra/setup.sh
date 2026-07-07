#!/usr/bin/env bash
# One-time AWS infrastructure setup for D2D Blitz production.
# Run from a machine with AWS CLI + Docker installed and an IAM principal
# that has AdministratorAccess (or equivalent scoped permissions).
#
# Usage:
#   export AWS_PROFILE=your-profile   # or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
#   bash infra/setup.sh
#
# After this script completes:
#   1. Populate SSM parameters (see "SSM secrets" section below).
#   2. Add the GitHub OIDC role ARN as a GitHub Actions secret: DEPLOY_ROLE_ARN.
#   3. Push to main — the deploy workflow will build, migrate, and deploy.

set -euo pipefail

ACCOUNT_ID=596871238996
REGION=us-east-1
APP=d2dblitz
DOMAIN=app.d2dblitz.zachjohnson.dev
HOSTED_ZONE_NAME=zachjohnson.dev
CLUSTER=${APP}-prod
SERVICE=${APP}-web
ECR_REPO=${APP}-app
DB_INSTANCE=${APP}-db
DB_NAME=d2dblitz
DB_USER=d2dblitz_admin
VPC_CIDR=10.0.0.0/16

echo "=== D2D Blitz — one-time infra setup ==="
echo "Account: $ACCOUNT_ID | Region: $REGION"

# ── 1. VPC & networking ───────────────────────────────────────────────────────
echo "[1/10] VPC..."
VPC_ID=$(aws ec2 create-vpc --cidr-block $VPC_CIDR --region $REGION \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP}-vpc}]" \
  --query Vpc.VpcId --output text)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Two public subnets (ALB) + two private subnets (ECS + RDS)
for AZ in a b; do
  PUB_CIDR="10.0.$( [ $AZ = a ] && echo 1 || echo 2 ).0/24"
  PRIV_CIDR="10.0.$( [ $AZ = a ] && echo 11 || echo 12 ).0/24"
  aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block $PUB_CIDR \
    --availability-zone ${REGION}${AZ} \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP}-pub-${AZ}}]"
  aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block $PRIV_CIDR \
    --availability-zone ${REGION}${AZ} \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP}-priv-${AZ}}]"
done

IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${APP}-igw}]" \
  --query InternetGateway.InternetGatewayId --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

PUB_RTB=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${APP}-pub-rtb}]" \
  --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id $PUB_RTB --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID

PUB_SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=${APP}-pub-*" \
  --query 'Subnets[*].SubnetId' --output text)
for SN in $PUB_SUBNETS; do
  aws ec2 associate-route-table --route-table-id $PUB_RTB --subnet-id $SN
  aws ec2 modify-subnet-attribute --subnet-id $SN --map-public-ip-on-launch
done

PRIV_SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=${APP}-priv-*" \
  --query 'Subnets[*].SubnetId' --output text)

echo "  VPC: $VPC_ID | Pub: $PUB_SUBNETS | Priv: $PRIV_SUBNETS"

# ── 2. Security groups ────────────────────────────────────────────────────────
echo "[2/10] Security groups..."
ALB_SG=$(aws ec2 create-security-group --group-name ${APP}-alb-sg \
  --description "ALB — HTTP/HTTPS from internet" --vpc-id $VPC_ID \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --ip-permissions '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},{"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]'

ECS_SG=$(aws ec2 create-security-group --group-name ${APP}-ecs-sg \
  --description "ECS tasks — port 3000 from ALB" --vpc-id $VPC_ID \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG \
  --protocol tcp --port 3000 --source-group $ALB_SG

RDS_SG=$(aws ec2 create-security-group --group-name ${APP}-rds-sg \
  --description "RDS — port 5432 from ECS" --vpc-id $VPC_ID \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $RDS_SG \
  --protocol tcp --port 5432 --source-group $ECS_SG

echo "  ALB SG: $ALB_SG | ECS SG: $ECS_SG | RDS SG: $RDS_SG"

# ── 3. RDS PostgreSQL ─────────────────────────────────────────────────────────
echo "[3/10] RDS PostgreSQL (db.t3.micro)..."
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

aws rds create-db-subnet-group \
  --db-subnet-group-name ${APP}-db-subnet \
  --db-subnet-group-description "${APP} DB subnet group" \
  --subnet-ids $PRIV_SUBNETS

aws rds create-db-instance \
  --db-instance-identifier $DB_INSTANCE \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 17 \
  --master-username $DB_USER \
  --master-user-password "$DB_PASSWORD" \
  --db-name $DB_NAME \
  --db-subnet-group-name ${APP}-db-subnet \
  --vpc-security-group-ids $RDS_SG \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --deletion-protection

echo "  Waiting for RDS to become available (5-10 min)..."
aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE

DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier $DB_INSTANCE \
  --query 'DBInstances[0].Endpoint.Address' --output text)

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
echo "  DB endpoint: $DB_HOST"

# ── 4. SSM Parameter Store ────────────────────────────────────────────────────
echo "[4/10] SSM parameters..."
aws ssm put-parameter --name /d2dblitz/DATABASE_URL --type SecureString \
  --value "$DATABASE_URL" --overwrite

# Remaining secrets — fill in real values before running
echo ""
echo "  *** ACTION REQUIRED — populate these SSM parameters manually: ***"
echo "  aws ssm put-parameter --name /d2dblitz/AUTH_SECRET      --type SecureString --value '<32-char random string>'"
echo "  aws ssm put-parameter --name /d2dblitz/CRON_SECRET      --type SecureString --value '<random string>'"
echo "  aws ssm put-parameter --name /d2dblitz/RESEND_API_KEY   --type SecureString --value '<resend key>'"
echo "  aws ssm put-parameter --name /d2dblitz/STRIPE_SECRET_KEY --type SecureString --value '<stripe key>'"
echo "  aws ssm put-parameter --name /d2dblitz/SENTRY_DSN       --type SecureString --value '<sentry dsn>'"
echo ""

# ── 5. ECR repository ─────────────────────────────────────────────────────────
echo "[5/10] ECR repository..."
aws ecr describe-repositories --repository-names $ECR_REPO 2>/dev/null || \
  aws ecr create-repository --repository-name $ECR_REPO \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256

# ── 6. IAM roles ──────────────────────────────────────────────────────────────
echo "[6/10] IAM roles..."
# ECS task execution role
aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' 2>/dev/null || true
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true
aws iam put-role-policy --role-name ecsTaskExecutionRole \
  --policy-name ssm-read --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Action":["ssm:GetParameters","kms:Decrypt"],
      "Resource":["arn:aws:ssm:'$REGION':'$ACCOUNT_ID':parameter/d2dblitz/*"]}]}'

# ECS task role (app permissions)
aws iam create-role --role-name d2dblitzTaskRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' 2>/dev/null || true

# GitHub Actions OIDC role
OIDC_PROVIDER=$(aws iam list-open-id-connect-providers \
  --query "OIDCProviderList[?ends_with(Arn,'token.actions.githubusercontent.com')].Arn" \
  --output text)
if [ -z "$OIDC_PROVIDER" ]; then
  OIDC_PROVIDER=$(aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    --client-id-list sts.amazonaws.com \
    --query OpenIDConnectProviderArn --output text)
fi

aws iam create-role --role-name github-actions-d2dblitz \
  --assume-role-policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Principal\":{\"Federated\":\"$OIDC_PROVIDER\"},
      \"Action\":\"sts:AssumeRoleWithWebIdentity\",
      \"Condition\":{\"StringLike\":{
        \"token.actions.githubusercontent.com:sub\":\"repo:*\/d2d-blitz:ref:refs/heads/main\"
      }}
    }]
  }" 2>/dev/null || true

aws iam put-role-policy --role-name github-actions-d2dblitz \
  --policy-name deploy --policy-document '{
    "Version":"2012-10-17",
    "Statement":[
      {"Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
      {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage","ecr:PutImage","ecr:InitiateLayerUpload","ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"],
        "Resource":"arn:aws:ecr:'$REGION':'$ACCOUNT_ID':repository/'$ECR_REPO'"},
      {"Effect":"Allow","Action":["ecs:RegisterTaskDefinition","ecs:DescribeTaskDefinition"],
        "Resource":"*"},
      {"Effect":"Allow","Action":["ecs:UpdateService","ecs:DescribeServices","ecs:RunTask",
        "ecs:DescribeTasks","ecs:ListTasks"],
        "Resource":"*"},
      {"Effect":"Allow","Action":["iam:PassRole"],
        "Resource":["arn:aws:iam::'$ACCOUNT_ID':role/ecsTaskExecutionRole",
                    "arn:aws:iam::'$ACCOUNT_ID':role/d2dblitzTaskRole"]}
    ]
  }'

# ── 7. CloudWatch log group ───────────────────────────────────────────────────
echo "[7/10] CloudWatch log group..."
aws logs create-log-group --log-group-name /ecs/d2dblitz-web --region $REGION 2>/dev/null || true
aws logs put-retention-policy --log-group-name /ecs/d2dblitz-web --retention-in-days 30

# ── 8. ECS Fargate cluster ────────────────────────────────────────────────────
echo "[8/10] ECS cluster..."
aws ecs create-cluster --cluster-name $CLUSTER \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 2>/dev/null || true

# ── 9. ALB + target group ─────────────────────────────────────────────────────
echo "[9/10] ALB + ACM cert + Route 53..."
ALB_ARN=$(aws elbv2 create-load-balancer --name ${APP}-alb \
  --subnets $PUB_SUBNETS \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

TG_ARN=$(aws elbv2 create-target-group \
  --name ${APP}-tg \
  --protocol HTTP --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# ACM certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --validation-method DNS \
  --query CertificateArn --output text)

echo "  ACM cert $CERT_ARN — validating via DNS (creating Route 53 record)..."
sleep 10
CERT_CNAME=$(aws acm describe-certificate --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output json)
CNAME_NAME=$(echo $CERT_CNAME | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['Name'])")
CNAME_VALUE=$(echo $CERT_CNAME | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['Value'])")

ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name $HOSTED_ZONE_NAME \
  --query 'HostedZones[0].Id' --output text | sed 's|/hostedzone/||')

aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID \
  --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{
    \"Name\":\"$CNAME_NAME\",\"Type\":\"CNAME\",\"TTL\":300,
    \"ResourceRecords\":[{\"Value\":\"$CNAME_VALUE\"}]}}]}"

echo "  Waiting for cert validation (up to 5 min)..."
aws acm wait certificate-validated --certificate-arn $CERT_ARN

# ALB listeners
aws elbv2 create-listener --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"

aws elbv2 create-listener --load-balancer-arn $ALB_ARN \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions "Type=forward,TargetGroupArn=$TG_ARN"

# Route 53 A alias
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text)
ALB_ZONE=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].CanonicalHostedZoneId' --output text)

aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID \
  --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{
    \"Name\":\"$DOMAIN\",\"Type\":\"A\",\"AliasTarget\":{
      \"HostedZoneId\":\"$ALB_ZONE\",\"DNSName\":\"$ALB_DNS\",\"EvaluateTargetHealth\":true}}}]}"

# ── 10. ECS service (initial — no task def yet; deploy workflow registers it) ─
echo "[10/10] ECS service..."
aws ecs create-service \
  --cluster $CLUSTER \
  --service-name $SERVICE \
  --launch-type FARGATE \
  --desired-count 1 \
  --task-definition d2dblitz-web \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIV_SUBNETS],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=d2dblitz-web,containerPort=3000" \
  --health-check-grace-period-seconds 120 \
  --scheduling-strategy REPLICA 2>/dev/null || \
  echo "  Service already exists — skipping create"

echo ""
echo "=== Infrastructure setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Fill in remaining SSM parameters (see output above)"
echo "  2. Set GitHub repo secret AWS_REGION=us-east-1 (already in workflow)"
echo "  3. Update workflow role ARN if needed:"
echo "     arn:aws:iam::$ACCOUNT_ID:role/github-actions-d2dblitz"
echo "  4. Push to main — deploy workflow will build image, migrate DB, deploy"
echo "  5. Smoke test: curl -I https://$DOMAIN/api/health"
