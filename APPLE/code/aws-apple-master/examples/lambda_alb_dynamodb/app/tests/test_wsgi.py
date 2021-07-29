import unittest

from flask import Flask
from flask_bootstrap import Bootstrap

from example.wsgi import app as example_app
from example.wsgi import bootstrap


class WsgiTest(unittest.TestCase):
    """Unit tests for Lambda Example WSGI application."""
    def test_wsgi(self):
        """
        Test Flask app & extension instantiation.
        """
        self.assertEqual(type(bootstrap), Bootstrap)
        self.assertEqual(type(example_app), Flask)
        self.assertEqual(len(example_app.config), 46)


if __name__ == '__main__':
    unittest.main()
