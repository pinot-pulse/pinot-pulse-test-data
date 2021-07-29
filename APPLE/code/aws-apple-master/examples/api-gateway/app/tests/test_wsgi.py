import unittest

from flask import Flask

from example.wsgi import app as example_app


class WsgiTest(unittest.TestCase):
    """Unit tests for Lambda Example WSGI application."""
    def test_wsgi(self):
        """
        Test Flask app & extension instantiation.
        """
        self.assertEqual(type(example_app), Flask)
        self.assertEqual(len(example_app.config), 32)


if __name__ == '__main__':
    unittest.main()
