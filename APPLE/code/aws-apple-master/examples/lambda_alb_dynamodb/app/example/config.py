"""AWS@Apple Example Configuration.

This module houses application configuration objects.
"""
import json
import os
import sys

from botocore.exceptions import ClientError
import boto3

try:
    sm = boto3.client('secretsmanager')
except ClientError as e:
    print(e.response['Error']['Message'])
    sys.exit(1)

try:
    s3 = boto3.client('s3')
except ClientError as e:
    print(e.response['Error']['Message'])
    sys.exit(1)


class Config(object):
    """Config() holds necessary application configuration parameters
    to be utilized by the Example Flask application."""
    DYNAMODB_HOST = os.environ.get('DYNAMODB_HOST')
    DYNAMODB_USER_TABLE = os.environ.get('DYNAMODB_TABLE_NAME')
    SECRET_NAME = os.environ.get('SECRET_NAME')
    BUCKET_NAME = os.environ.get('BUCKET_NAME')
    OBJECT_NAME = 'css/styles.css'
    FILE_NAME = 'styles.css'

    @classmethod
    def get_secrets(cls):
        """
        Fetch AppleConnect secrets from Secrets Manager.

        :param cls: a Config class object
        :return secrets: json object returned from Secrets Manager
        """
        try:
            response = sm.get_secret_value(SecretId=cls.SECRET_NAME)
        except ClientError as e:
            print(e)
            sys.exit(1)
        else:
            secret = response['SecretString']
            return json.loads(secret)

    @classmethod
    def get_css(cls):
        """
        Retrieve a CSS file from S3.

        This method enables the ability to quickly deploy styling
        changes without having to redeploy the entire Lambda
        function.

        :param cls: a Config class object
        :return True
        """
        try:
            s3.download_file(cls.BUCKET_NAME, cls.OBJECT_NAME, cls.FILE_NAME)
        except ClientError as e:
            print(e)
            return False

        return True


class AppleConnectConfig(object):
    """AppleConnectConfig() holds necessary AppleConnect configuration
    parameters to be utilized by the Flask-AppleConnect authentication
    library."""

    secrets = Config.get_secrets()

    ACCESS_GROUP = secrets['accessGroup']
    APPLECONNECT_APPLICATION_ID = secrets['appId']
    APPLECONNECT_APPLICATION_ID_KEY = secrets['appIdKey']
    APPLECONNECT_APPLICATION_ADMIN_PASSWORD = secrets['appPassword']
    APPLECONNECT_ENVIRONMENT = secrets['appEnvironment']
    APPLECONNECT_ATTRIBUTES = [
        'prsId', 'firstName', 'lastName', 'emailAddress', 'allGroups'
    ]


# Retrieve CSS
if Config.get_css():
    print("Custom CSS loaded.")
