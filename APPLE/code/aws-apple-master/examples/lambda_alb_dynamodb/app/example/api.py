"""AWS@Apple Flask Example API Blueprint.

This module represents an example Flask API Blueprint with routes
protected by AppleConnect authentication & DS Group membership.
"""
from flask import Blueprint, jsonify, redirect, render_template, url_for
from flask_appleconnect import FlaskAppleConnect

from example.wsgi import app
from example.models.user import User

ac = FlaskAppleConnect(app)
api = Blueprint('api', __name__)


def has_access(user):
    """Check whether or not user belongs to whitelisted Apple Directory
    group."""
    group = app.config['ACCESS_GROUP']

    if group in user['allGroups']:
        return True
    return False


@api.route('/')
@ac.auth(param='user')
def index(user):
    """Default route.

    get:
        summary: The root endpoint
        description: Redirects to the hello endpoint
        parameters:
            - user: dictionary of AppleConnect user attributes
        responses:
            302:
                description: Redirect to appropriate endpoint
            403:
                description: Failed to authenticate with AppleConnect
    """
    return redirect(url_for('api.hello'))


@api.route('/hello')
@ac.auth(param='user')
def hello(user):
    """ Hello route.
    get:
        summary: The hello endpoint
        description: Get a message containing the user's name
        parameters:
            - user: dictionary of AppleConnect user attributes.
        responses:
            200:
                description: HTML page containing message to be returned
    """
    if has_access(user):

        User.create(user)

        return render_template('hello.html',
                               first=user['firstName'],
                               last=user['lastName'],
                               group=app.config['ACCESS_GROUP'])

    return redirect(url_for('api.goodbye'))


@api.route('/goodbye')
@ac.auth(param='user')
def goodbye(user):
    """ Goodbye Route.

    get:
        summary: The goodbye endpoint
        description: Get an unauthorized error containing the user's name
        parameters:
            - user: dictionary of AppleConnect user attributes
        responses:
            403:
                description: Json object containing message to be returned
                             and HTTP status code
    """
    return render_template('goodbye.html',
                           first=user['firstName'],
                           last=user['lastName']), 403


@api.route('/internal/<check>')
def health_check(check='health'):
    """ Health Check Route.

    get:
        summary: The health check endpoint
        description: Get a message containing the check parameter
                     included in the URL
        parameters:
            - user: dictionary of AppleConnect user attributes
        responses:
            200:
                description: Json object containing message to be returned
                             and HTTP status code
    """
    return jsonify(message='I am in good {}'.format(check), status=200)
