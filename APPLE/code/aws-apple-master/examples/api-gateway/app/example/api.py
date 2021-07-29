"""AWS@Apple Flask Example API Blueprint.

This module represents an example Flask API Blueprint with routes
protected by AppleConnect authentication & DS Group membership.
"""
from flask import Blueprint, jsonify, request

from example.models.user import User

api = Blueprint('api', __name__)


@api.app_errorhandler(404)
def not_found(error):
    """404 Error handler."""
    return jsonify(error='Not found'), 404


@api.app_errorhandler(405)
def not_allowed(error):
    """405 Error handler."""
    return jsonify(error='Method not allowed'), 405


@api.app_errorhandler(500)
def server_error(error):
    """500 Error handler."""
    return jsonify(error=error), 500


@api.route('/api/user', methods=['GET'])
def get_users():
    """ User route.
    get:
        summary: The user API endpoint
        description: Get a list of all users in the DynamoDB table
        responses:
            200:
                description: JSON object containing all recorded users
    """

    users = User.get_all_users()
    return jsonify(users=users)


@api.route('/api/user/<dsid>', methods=['GET'])
def get_user(dsid):
    """ User Route.

    get:
        summary: The user API endpoint
        description: Get a user from the DynamoDB table
        parameters:
            dsid:
                description: the DSID of the user
        responses:
            200:
                description: JSON message containing query result
    """

    user = User.get_user(dsid)
    return jsonify(user=user)


@api.route('/api/user/<dsid>', methods=['POST'])
def create_user(dsid):
    """ User Route.

    post:
        summary: The user API endpoint
        description: Create a user in the DynamoDB table
        parameters:
            dsid:
                description: the DSID of the user
        responses:
            200:
                description: JSON message containing response
            400:
                description: error message due to malformed JSON
    """
    if not dsid:
        return jsonify(error="No DSID specified"), 400
    if not request.get_json():
        return jsonify(
            error="Payload body is missing"
        ), 400

    User.create(dsid, request.json)
    return jsonify(created={"dsid": dsid, "details": request.json})


@api.route('/api/user/<dsid>', methods=['DELETE'])
def delete_user(dsid):
    """ User Route.

    delete:
        summary: The user API endpoint
        description: Delete a user in the DynamoDB table
        parameters:
            dsid:
                description: the DSID of the user
        responses:
            200:
                description: JSON message containing response
    """
    User.destroy(dsid)
    return jsonify(deleted=dsid)
