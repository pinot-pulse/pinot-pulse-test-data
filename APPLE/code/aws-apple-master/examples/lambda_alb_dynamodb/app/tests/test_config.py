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
        self.assertEqual(conf.SECRET_NAME, os.environ.get('SECRET_NAME'))
        self.assertEqual(conf.BUCKET_NAME, os.environ.get('BUCKET_NAME'))

    def test_Config_get_secrets(self):
        """
        Test get_secrets() method functionality.
        """
        conf = config.Config
        secrets = conf.get_secrets()
        self.assertEqual(secrets['appEnvironment'], 'UAT')

    def test_AppleConnectConfig(self):
        """
        Test AppleConnect configuration instantiation.
        """
        conf = config.AppleConnectConfig()
        self.assertEqual(conf.APPLECONNECT_ENVIRONMENT, 'UAT')


if __name__ == '__main__':
    unittest.main()
