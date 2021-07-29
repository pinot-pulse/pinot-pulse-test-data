#!/usr/bin/env python

import sys
import boto3

for bucket in sys.argv[1:]:
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(bucket)
    if bucket.creation_date:
        try:
            print("Deleting: %s" % (bucket))
            bucket.object_versions.all().delete()
            bucket.delete()
        except:
            print("%s no longer exists." % (bucket))            
    else:
        print("%s no longer exists." % (bucket))
