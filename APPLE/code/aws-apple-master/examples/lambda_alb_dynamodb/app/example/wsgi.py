"""Example Flask WSGI Application.

This module serves as the entrypoint for the Flask application
and AWS Lambda function. After registering the API blueprint,
we wrap the application in an apig-wsgi lambda handler function.
"""
from flask import Flask
from flask_bootstrap import Bootstrap
from apig_wsgi import make_lambda_handler

from example.config import Config, AppleConnectConfig

app = Flask(__name__, static_url_path='', static_folder='/')
bootstrap = Bootstrap(app)

app.config.from_object(Config)
app.config.from_object(AppleConnectConfig)

# Late import to register blueprint
from example.api import api
app.register_blueprint(api)

lambda_handler = make_lambda_handler(app)
