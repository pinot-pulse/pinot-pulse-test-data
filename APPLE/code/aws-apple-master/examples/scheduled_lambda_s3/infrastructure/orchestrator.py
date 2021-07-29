import os
import sys
import boto3

s3 = boto3.client("s3")

basepath = os.path.dirname(os.path.realpath(__file__))

if not os.environ.get("STATEFILE_BUCKET", ""):
    os.environ["STATEFILE_BUCKET"] = os.environ.get("BUCKET_NAME")

if not os.environ.get("STATEFILE_LOCATION", ""):
    os.environ["STATEFILE_LOCATION"] = os.environ.get("FUNCTION_NAME") + "-sched-lambda"

bucket = os.environ.get("STATEFILE_BUCKET")
key = os.environ.get("STATEFILE_LOCATION")


def execute_safely(cmd):
    status = os.WEXITSTATUS(os.system(cmd))
    if status != 0:
        raise Exception(f"Error, exit status {status} for cmd : {cmd}")


def provision():
    # Create S3 if needed
    if os.environ["CREATE_BUCKET"].lower() == "true":
        os.chdir(f"{basepath}/s3")
        os.system("pwd")
        execute_safely("./provision.sh")

    # Create Role/Policy
    os.chdir(f"{basepath}/role")
    execute_safely("pwd")
    execute_safely("./provision.sh")

    # Create Lambda
    os.chdir(f"{basepath}/lambda")
    execute_safely("pwd")
    execute_safely("./provision.sh")

    # Create event
    if not os.environ.get("TF_VAR_RULE_NAME"):
        os.environ["TF_VAR_RULE_NAME"] = f"{os.environ['TF_VAR_FUNCTION_NAME']}-scheduler"

    os.chdir(f"{basepath}/event")
    execute_safely("./provision.sh")


def cleanup():
    # Delete event
    os.environ["TF_VAR_RULE_NAME"] = os.environ.get("TF_VAR_RULE_NAME",
                                                    f"{os.environ['TF_VAR_FUNCTION_NAME']}-scheduler")
    os.chdir(f"{basepath}/event")
    execute_safely("./cleanup.sh")

    # Delete Lambda if needed
    os.chdir(f"{basepath}/lambda")
    execute_safely("./cleanup.sh")

    # Delete Role/Policy
    os.chdir(f"{basepath}/role")
    execute_safely("./cleanup.sh")

    # Delete S3 if needed
    if os.environ["CREATE_BUCKET"].lower() == "true":
        os.chdir(f"{basepath}/s3")
        os.system("pwd")
        execute_safely("./cleanup.sh")


if sys.argv[1] == "provision":
    provision()
elif sys.argv[1] == "cleanup":
    cleanup()
elif sys.argv[1] == "update":
    provision()
