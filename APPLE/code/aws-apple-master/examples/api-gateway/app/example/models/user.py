"""Example User Model.

This module represents an example PynamoDB User model to
store user details derived from AppleConnect in a DynamoDB
'user' table.
"""
from datetime import datetime
from pynamodb.models import Model
from pynamodb.attributes import UnicodeAttribute, UTCDateTimeAttribute
from pynamodb.exceptions import DoesNotExist, PutError
import pytz

from example.wsgi import app


class User(Model):
    """
    A User Model for DynamoDB.
    """
    class Meta:
        table_name = app.config["DYNAMODB_USER_TABLE"]
        region = app.config["AWS_REGION"]
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
    def serialize(cls, item):
        serialized = {}
        for key in item.attribute_values:
            serialized[key] = item.__getattribute__(key)
        return serialized

    @classmethod
    def time_now(cls):
        """Generate a current UTC timestamp."""
        utc_tz = pytz.timezone('UTC')
        return datetime.now(utc_tz)

    @classmethod
    def get_user(cls, dsid):
        """Get a single user form the table"""
        try:
            user = cls.get(dsid)
        except DoesNotExist:
            app.logger.info("User {} does not exist".format(dsid))
            return ""
        return cls.serialize(user)

    @classmethod
    def get_all_users(cls):
        """Get all users in the table"""
        users = []
        for item in cls.scan():
            users.append(cls.serialize(item))
        return users

    @classmethod
    def create(cls, dsid, user_obj):
        """Create a user if it does not already exist."""
        user_item = cls(dsid=dsid,
                        first_name=user_obj['firstName'],
                        last_name=user_obj['lastName'],
                        email=user_obj['emailAddress'],
                        created=cls.time_now())
        try:
            user_item.save(cls.dsid.does_not_exist())
        except PutError as error:
            code = error.cause.response['Error'].get('Code')
            if code == "ConditionalCheckFailedException":
                app.logger.info("User exists, skipping table write")

    @classmethod
    def destroy(cls, dsid):
        """Delete a user from the table."""
        user_item = cls(dsid=dsid)
        cls.delete(user_item)


if not User.exists():
    User.create_table(wait=True)
