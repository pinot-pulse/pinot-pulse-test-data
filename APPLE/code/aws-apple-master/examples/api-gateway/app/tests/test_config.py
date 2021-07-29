import os
import unittest

from dotenv import load_dotenv

import example.config as config


class ConfigTest(unittest.TestCase):
    """Unit tests for Lambda Example Config."""

    load_dotenv()

    def test_Config(self):
        """
        Test primary configuration instantiation.
        """
        conf = config.Config()
        self.assertEqual(conf.DYNAMODB_USER_TABLE,
                         os.environ.get('DYNAMODB_TABLE_NAME'))


if __name__ == '__main__':
    unittest.main()
