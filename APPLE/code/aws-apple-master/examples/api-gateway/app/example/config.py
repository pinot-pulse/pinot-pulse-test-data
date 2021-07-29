"""AWS@Apple Example Configuration.

This module houses application configuration objects.
"""
import os


class Config(object):
    """Config() holds necessary application configuration parameters
    to be utilized by the Example Flask application."""
    os.environ['SERVER_NAME'] = ''
    DYNAMODB_HOST = os.environ.get('DYNAMODB_HOST')
    DYNAMODB_USER_TABLE = os.environ.get('DYNAMODB_TABLE_NAME')
    AWS_REGION = os.environ.get('AWS_REGION', "us-west-2")
