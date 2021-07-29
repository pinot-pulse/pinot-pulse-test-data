"""Example User Model.

This module represents an example PynamoDB User model to
store user details derived from AppleConnect in a DynamoDB
'user' table.
"""
from datetime import datetime
from pynamodb.models import Model
from pynamodb.attributes import UnicodeAttribute, UTCDateTimeAttribute
from pynamodb.exceptions import PutError

import pytz

from example.wsgi import app


class User(Model):
    """
    A User Model for DynamoDB.
    """
    class Meta:
        table_name = app.config["DYNAMODB_USER_TABLE"]
        region = 'us-west-2'
        if app.config["DYNAMODB_HOST"]:
            host = app.config["DYNAMODB_HOST"]
        write_capacity_units = 10
        read_capacity_units = 10

    dsid = UnicodeAttribute(hash_key=True)
    first_name = UnicodeAttribute()
    last_name = UnicodeAttribute()
    email = UnicodeAttribute()
    created = UTCDateTimeAttribute()

    @classmethod
    def time_now(cls):
        """Generate a current UTC timestamp."""
        utc_tz = pytz.timezone('UTC')
        return datetime.now(utc_tz)

    @classmethod
    def create(cls, user):
        """Create a user if it does not already exist."""
        user_item = cls(dsid=user["prsId"],
                        first_name=user['firstName'],
                        last_name=user['lastName'],
                        email=user['emailAddress'],
                        created=cls.time_now())
        try:
            user_item.save(cls.dsid.does_not_exist())
        except PutError as error:
            code = error.cause.response['Error'].get('Code')
            if code == "ConditionalCheckFailedException":
                app.logger.info("User exists, skipping table write")


if not User.exists():
    User.create_table(wait=True)
