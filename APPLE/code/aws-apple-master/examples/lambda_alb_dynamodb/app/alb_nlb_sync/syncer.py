""" ALB NLB Sync Syncer
This module queries DNS for the deployed Application Load Balancer's
IP addresses. It populates the Network Load Balancer's target group with
the resulting IP addresses.

WARNING: This function performs multiple DNS lookups per invocation. It is not
guaranteed that all ALB IPs will be detected by a single invocation; however,
the results aggregate when additional invocations are triggered. This function
performs aggressive registration and cautious deregistration.

NOTE: This code was taken from https://aws.amazon.com/blogs/networking-
      and-content-delivery/using-static-ip-addresses-for-application-
      load-balancers/, converted to python 3.7, and refactored to work
      in AWS@Apple.
"""
import boto3
import json
import sys
import tempfile

from botocore.exceptions import ClientError
from dns import resolver

from alb_nlb_sync.config import Config

try:
    s3 = boto3.resource('s3')
except Exception:
    print("ERROR: failed to connect to S3")
    sys.exit(1)

try:
    cwclient = boto3.client('cloudwatch')
except ClientError as e:
    print(e.response['Error']['Message'])
    sys.exit(1)
try:
    elbv2client = boto3.client('elbv2')
except ClientError as e:
    print(e.response['Error']['Message'])
    sys.exit(1)


def check_and_deregister_ips(new_pending_ip_dict):
    """
    Check a dictionary of IPs pending deregistration.

    Checks whether or not the dict is empty and deregisters
    the targets if they are present.

    :param new_pending_ip_dict: dictionary of ips that are
                                pending deregistration
    """
    dereg_ip_list = []
    if new_pending_ip_dict:
        pending_ip_list = list(new_pending_ip_dict.keys())
        dereg_ip_list = [
            dereg_ip_list.append(ip) for ip in pending_ip_list
            if new_pending_ip_dict[ip] >= Config.max_invocations
        ]
        deregister_target_list = target_group_list(dereg_ip_list)
        deregister_target(Config.nlb_tg_arn, deregister_target_list)

    else:
        print("INFO: No old target deregistered")


def check_and_register_ips(reg_ip_list):
    """
    Check a dictionary of IPs pending registration.

    Checks whether or not the dict is empty and registers
    the targets if they are present.

    :param reg_ip_list: list of ALB IPs to register
    """
    if reg_ip_list:
        register_target_list = target_group_list(reg_ip_list)
        register_target(Config.nlb_tg_arn, register_target_list)
        print("INFO: Registering {}".format(reg_ip_list))

    else:
        print("INFO: No new target registered")


def check_deregistration(old_active_ip_set, new_active_ip_set,
                         old_active_ip_dict, registered_ip_set,
                         old_pending_ip_dict):
    """
    Check for ALB IPs that need to be deregistered.

    :param old_active_ip_set: deduped set of active IPs from last
                              invocation's S3 file
    :param new_active_ip_set: deduped set of active IPs from current
                              invocation
    :param old_active_ip_dict: dictionary of active IPs from last
                               invoaction's S3 file
    :param registered_ip_set:  deduped set of currently registered
                               ALB IPs
    :param old_pending_ip_dict: dictionary of IPs pending
                                deregistration from last invocation's
                                S3 file.
    :return: dictionary of new IPs pending deregistration
    """
    new_pending_ip_dict = {}
    if old_active_ip_dict:
        old_diff_ip_set_from_s3 = old_active_ip_set - new_active_ip_set
        old_diff_ip_set_from_describe = registered_ip_set - new_active_ip_set
        deregister_ip_diff_set = (old_diff_ip_set_from_s3
                                  | old_diff_ip_set_from_describe)
        print("INFO: Pending deregistration IPs from current invocation - {}".
              format(deregister_ip_diff_set))

        if old_pending_ip_dict:
            old_pending_ip_set = set(old_pending_ip_dict.keys())
            print("INFO: Pending deregistration IPs from last invocation - {}".
                  format(old_pending_ip_set))

            # Additional IPs are not in the old pending list
            additional_ip_set = deregister_ip_diff_set - old_pending_ip_set
            print("INFO: Additional pending IPs "
                  "(in the current but not last invocation) - {}".format(
                      additional_ip_set))

            for ip in additional_ip_set:
                old_pending_ip_dict[ip] = 1

            # Existing IPs that already in the old pending list
            existing_ip_set = deregister_ip_diff_set & old_pending_ip_set
            print("INFO: Existing pending IPs "
                  "(in both the current and last invocation) - {}".format(
                      existing_ip_set))

            for ip in existing_ip_set:
                old_pending_ip_dict[ip] += 1

            # Missing IPs in old pending list that are no longer
            # in the new pending list
            missing_ip_set = old_pending_ip_set - deregister_ip_diff_set
            print("INFO: Missing pending IPs "
                  "(in the last but not current invocation) - {}".format(
                      missing_ip_set))

            for ip in missing_ip_set:
                old_pending_ip_dict.pop(ip)
            new_pending_ip_dict = old_pending_ip_dict

        else:
            for ip in deregister_ip_diff_set:
                new_pending_ip_dict[ip] = 1
        print("INFO: New pending deregisration IP- {}".format(
            new_pending_ip_dict))
    else:
        print("INFO: No active IP List from last invocation")
    return new_pending_ip_dict


def check_registration(new_active_ip_set, registered_ip_set,
                       old_active_ip_dict):
    """
    Check for ALB IPs that need to be registered.

    :param new_active_ip_set: deduped set of active IPs from current
                              invocation
    :param registered_ip_set: deduped set of currently registered
                               ALB IPs
    :param old_active_ip_dict: dictionary of active IPs from last
                               invoaction's S3 file
    :return: set of active ips from last invocation, and list of
             ALB IPs to register
    """
    new_diff_ip_set_from_describe = new_active_ip_set - registered_ip_set
    old_active_ip_set = set()

    if old_active_ip_dict:
        old_active_ip_set = set(old_active_ip_dict['IPList'])
        new_diff_ip_set_from_s3 = new_active_ip_set - old_active_ip_set
        reg_ip_list = list(new_diff_ip_set_from_s3
                           | new_diff_ip_set_from_describe)
    # IPs that have not been registered
    else:
        reg_ip_list = list(new_diff_ip_set_from_describe)
    return old_active_ip_set, reg_ip_list


def put_metric_data(ip_dict):
    """
    Publish IPCount metric data to CloudWatch.

    :param ip_dict: dictionary containing current invocation
                    details
    """
    try:
        cwclient.put_metric_data(Namespace='AWS/ApplicationELB',
                                 MetricData=[{
                                     'MetricName':
                                     "LoadBalancerIPCount",
                                     'Dimensions': [
                                         {
                                             'Name': 'LoadBalancerName',
                                             'Value':
                                             ip_dict['LoadBalancerName']
                                         },
                                     ],
                                     'Value':
                                     float(ip_dict['IPCount']),
                                     'Unit':
                                     'Count'
                                 }])
    except ClientError as e:
        print(e.response['Error']['Message'])


def upload_ip_list(s3_bucket, filename, json_object, object_key):
    """
    Upload an IP address list of ALB IPs to S3.

    :param s3_bucket: name of the S3 bucket to upload the file to
    :param json_object: object containing active or pending ips
    :param object_key: key of the s3 object to upload
    """
    temp_file = tempfile.NamedTemporaryFile()
    with open(temp_file.name, 'w') as f:
        json.dump(json_object, f)

    try:
        s3.meta.client.upload_file(temp_file.name, s3_bucket, object_key)
    except Exception as e:
        print(e.response['Error']['Message'])


def download_ip_list(s3_bucket, object_key):
    """
    Download an IP address list of ALB IPs to S3.

    :param s3_bucket: name of the S3 bucket to upload the file to
    :param object_key: key of the s3 object to upload
    """
    try:
        s3client = boto3.client('s3')
    except Exception as e:
        print("ERROR: failed to connect to S3")
        print(e)

    try:
        response = s3client.get_object(Bucket=s3_bucket, Key=object_key)
    except Exception as e:
        print("ERROR: Failed to download IP list from S3. "
              "It is normal to see this message "
              "if it is the first time the Lambda function is triggered.")
        print(e)
        return '{}'
    ip_str = response['Body'].read()
    old_ip_dict = json.loads(ip_str)
    return old_ip_dict


def register_target(tg_arn, new_target_list):
    """
    Register ALB's IPs to NLB's target group.

    :param tg_arn: ARN of the NLB's Target Group
    :param new_target_list: list of new targets
                            to deregister
    """
    print("INFO: Register new_target_list:{}".format(new_target_list))
    try:
        elbv2client.register_targets(TargetGroupArn=tg_arn,
                                     Targets=new_target_list)
    except ClientError as e:
        print(e.response['Error']['Message'])


def deregister_target(tg_arn, new_target_list):
    """
    Deregister ALB's IPs from NLB's target group.

    :param tg_arn: ARN of the NLB's Target Group
    :param new_target_list: list of new targets
                            to deregister
    """
    try:
        print("INFO: Deregistering targets: {}".format(new_target_list))
        elbv2client.deregister_targets(TargetGroupArn=tg_arn,
                                       Targets=new_target_list)
    except ClientError as e:
        print(e.response['Error']['Message'])


def target_group_list(ip_list):
    """
    Create a list of targets for registration.

    :param ip_list: list of ALB IPs
    :return: list of target dictionaries
    """
    target_list = []
    for ip in ip_list:
        target = {
            'Id': ip,
            'Port': Config.alb_listener,
        }
        target_list.append(target)
    return target_list


def describe_target_health(tg_arn):
    """
    Get a list of registered targets in the NLB's target group.

    :param tg_arn: ARN of the NLB's target group
    :return: list of currently registered ALB IPs
    """
    registered_ip_list = []
    print("Describing target health for {}".format(tg_arn))
    try:
        response = elbv2client.describe_target_health(TargetGroupArn=tg_arn)
        print(response)
        registered_ip_count = len(response['TargetHealthDescriptions'])
        print("INFO: Number of currently registered IP: ", registered_ip_count)
        for target in response['TargetHealthDescriptions']:
            registered_ip = target['Target']['Id']
            registered_ip_list.append(registered_ip)
    except ClientError as e:
        print(e.response['Error']['Message'])
    return registered_ip_list


def dns_lookup(domainname, record_type):
    """
    Get DNS lookup results for ALB's domain name.

    :param domainname: DNS name of ALB
    :param record_type: type of DNS record
    :return: list of dns lookup results
    """
    print("{} --- {}".format(domainname, record_type))
    lookup_result_list = []
    my_resolver = resolver.Resolver()
    lookup_answer = my_resolver.query(domainname, record_type)
    print("lookup_answer: {}".format(lookup_answer))
    for answer in lookup_answer:
        lookup_result_list.append(str(answer))
    return lookup_result_list


def check_invocations(max_lookups, max_invocations):
    if max_lookups <= 0:
        print("ERROR: max_lookups is negative or zero, try again")
        sys.exit(1)
    if max_invocations <= 0:
        print("ERROR: max_invocations  is negative or zero, try again")
        sys.exit(1)


def check_for_empty_ip_list(regular_record_set):
    """
    Check if DNS results are empty.

    An ALB should never have zero IPs in DNS; if this occurs, the
    Lambda function exits

    :param regular_record_set: list of IPs retrieved from A record
                               lookups
    """
    if not regular_record_set:
        print("ERROR: The number of IPs in DNS for the ALB is 0")
        print("ERROR: Script will not proceed with making changes.")
        sys.exit(1)


def lambda_handler(event, context):
    """
    The main Lambda handler invoked when the Lambda is called.

    This handler serves as the entrypoint for the Syncer Lambda
    function.
    """

    check_invocations(Config.max_lookups, Config.max_invocations)

    regular_record_set = []
    registered_ip_list = describe_target_health(Config.nlb_tg_arn)

    dns_lookup_result = dns_lookup(Config.alb_dns_name, "A")
    regular_record_set = set(dns_lookup_result) | set(regular_record_set)

    print("INFO: IPs detected by DNS lookup:", regular_record_set)
    print("INFO: Number of IPs detected by DNS lookup: ",
          len(regular_record_set))

    check_for_empty_ip_list(regular_record_set)

    new_active_ip_dict = {
        "LoadBalancerName": Config.alb_dns_name,
        "TimeStamp": Config.time,
        "IPList": list(regular_record_set),
        "IPCount": len(regular_record_set)
    }

    active_ip_json = json.dumps(new_active_ip_dict)

    if Config.cw_metric_flag_ip_count.lower() == "true":
        put_metric_data(new_active_ip_dict)

    # Construct set of new active IPs and registered IPs
    new_active_ip_set = set(new_active_ip_dict['IPList'])
    registered_ip_set = set(registered_ip_list)

    # Download old active IPs and old pending IPs from S3
    old_active_ip_dict = json.loads(
        download_ip_list(Config.s3_bucket, Config.active_ip_list_key))
    old_pending_ip_dict = json.loads(
        download_ip_list(Config.s3_bucket, Config.pending_ip_list_key))
    print(
        "INFO: Active IPs from last invocation: {}".format(old_active_ip_dict))
    print("INFO:Pending deregistration IP from last invocation: {}".format(
        old_pending_ip_dict))
    print("INFO: Active IPs from the current invocation {}".format(
        new_active_ip_dict))

    old_active_ip_set, reg_ip_list = check_registration(
        new_active_ip_set, registered_ip_set, old_active_ip_dict)

    new_pending_ip_dict = check_deregistration(old_active_ip_set,
                                               new_active_ip_set,
                                               old_active_ip_dict,
                                               registered_ip_set,
                                               old_pending_ip_dict)

    pending_ip_json = json.dumps(new_pending_ip_dict)
    upload_ip_list(Config.s3_bucket, Config.active_filename, active_ip_json,
                   Config.active_ip_list_key)
    upload_ip_list(Config.s3_bucket, Config.pending_filename, pending_ip_json,
                   Config.pending_ip_list_key)

    check_and_register_ips(reg_ip_list)
    check_and_deregister_ips(new_pending_ip_dict)
