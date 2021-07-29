import boto3
from .properties import Properties
from string import Template
from pathlib import Path

sts = boto3.client('sts')
credentials_template = """
[default]
appleconnect=
    username=$username
    password=$password
    deviceid=$deviceid
    totpsecret=$totpsecret
    aws_role=$role
    account_id=$account
"""

config_template = """
[default]
credential_process = awsappleconnect -p default
region = $region
"""


def checkIfLoggedIn():
    try:
        data = sts.get_caller_identity()
        print(data)
        return True
    except Exception:
        return False


def setup_cli(secrets_file, account, role, region):
    props = Properties(secrets_file)
    creds = Template(credentials_template)
    creds_file_content = creds.substitute(props.dict(), account=account, role=role,region=region)
    config = Template(config_template)
    config_file_content = config.substitute(region=region)
    # write the files
    home = Path.home()
    Path(f"{home}/.aws").mkdir(parents=True, exist_ok=True)
    with open(f"{home}/.aws/config", "w") as f:
        f.write(config_file_content)
    with open(f"{home}/.aws/credentials", "w") as f:
        f.write(creds_file_content)