"""ALB NLB Sync Configuration.

This module houses the configuration object for use by the ALB NLB
Syncer Lambda function.

The following variables are picked up from the Lambda function's
environment and are set via CloudFormation (see lambda_alb_dynamodb/
infrastructure/alb_nlb_syncer_lambda.yaml):
    1. ALB_DNS_NAME: The full DNS name of the ALB
    2. ALB_LISTENER: The traffic listener port of the ALB
    3. S3_BUCKET: The bucket used to track changes between Lambda invocations
    4. NLB_TG_ARN: The ARN of the NLB's target group
    5. MAX_LOOKUP_PER_INVOCATION: The max number of DNS lookups per invocation
    6. INVOCATIONS_BEFORE_DEREGISTRATION: The max number of required invocations
                                            before an IP is deregistered
    7. CW_METRIC_FLAG_IP_COUNT: The controller flag that enables CloudWatch metric
                            publishing

"""
import os
from datetime import datetime


class Config(object):
    """Config() holds necessary application configuration parameters
    to be utilized by the Example Flask application."""
    alb_dns_name = os.environ['ALB_DNS_NAME']
    alb_listener = int(os.environ['ALB_LISTENER'])
    s3_bucket = os.environ['S3_BUCKET']
    nlb_tg_arn = os.environ['NLB_TG_ARN']
    max_lookups = int(os.environ['MAX_LOOKUP_PER_INVOCATION'])
    max_invocations = int(
        os.environ['INVOCATIONS_BEFORE_DEREGISTRATION'])
    cw_metric_flag_ip_count = os.environ['CW_METRIC_FLAG_IP_COUNT']
    active_filename = 'Active IP list of {}.json'.format(alb_dns_name)
    pending_filename = 'Pending deregisteration IP list of {}.json'.format(
        alb_dns_name)
    active_ip_list_key = "{}-active-registered-IPs/{}".format(alb_dns_name, active_filename)
    pending_ip_list_key = "{}-pending-deregisteration-IPs/{}".format(alb_dns_name, pending_filename)
    time = datetime.strftime((datetime.utcnow()), '%Y-%m-%d %H:%M:%S')