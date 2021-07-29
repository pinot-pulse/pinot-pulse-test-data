import unittest

from moto import mock_dynamodb2

from example.models.user import User


@mock_dynamodb2
class UserTest(unittest.TestCase):
    """Unit tests for the DynamoDB integration."""
    def setUp(self):
        User.create_table(wait=True)
        super(UserTest, self).setUp()

    def tearDown(self):
        User.delete_table()
        super(UserTest, self).tearDown()

    def test_User_create(self):
        dsid = "123456789"
        user_item = User(dsid=dsid,
                         first_name="Jane",
                         last_name="Doe",
                         email="jane_doe@apple.com",
                         created=User.time_now())
        user_item.save()
        get_obj = User.get(dsid)
        self.assertEqual(user_item.dsid, get_obj.dsid)


if __name__ == '__main__':
    unittest.main()
