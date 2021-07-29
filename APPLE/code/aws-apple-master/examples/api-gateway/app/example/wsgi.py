"""Example Flask WSGI Application.

This module serves as the entrypoint for the Flask application
and AWS Lambda function. After registering the API blueprint,
we wrap the application in an apig-wsgi lambda handler function.
"""
import awsgi

from flask import Flask

from example.config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Late import to register blueprint
from example.api import api
app.register_blueprint(api)


def lambda_handler(event, context):
    return awsgi.response(app, event, context)
