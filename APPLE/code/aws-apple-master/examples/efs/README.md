# Amazon Elastic File System

Amazon Elastic File System (Amazon EFS) is a file storage service for Amazon Elastic Compute Cloud (Amazon EC2) instances. With Amazon EFS, your applications have storage when they need it because storage capacity grows and shrinks automatically as you add and remove files.

This example will walk through:

* Create a Amazon EFS file system
* Create mount targets for your file system in each Availability Zone
* Launch an EC2 instance, install efs-utils and mount the file system via encryption in-transit using stunnel. Create a sample file on the newly mounted file system

The following resources are created by the cloudformation templates:

* A Elastic File System
* Mount targets in each Availability Zone

#### Prerequisites

Before running this stack, you should launch an EC2 instance in the same VPC as your Elastic File System

#### 1. Create Elastic File System that is encrypted at rest with multiple mount targets in specific AZ’s using this example: [EFS template](efs.yaml)

```bash
aws cloudformation deploy --template-file efs.yaml --stack-name TestEFS \
--tags Component=myEFS \
Name=EFS \
--parameter-overrides PerformanceMode=generalPurpose \
StunnelTLSPort=2049 StunnelTLSMountHelperPortRangeFrom=20049 \
StunnelTLSMountHelperPortRangeTo=20449 \
DbSubnetIpBlocks="10.71.0.0/18, 10.71.64.0/18, 100.71.128.0/18" \
--profile dev

Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - TestEFS
```

Descbribe file system:

```bash
$ aws efs describe-file-system \
--region aws-region \
--profile dev
```

Make a note of your file system ID that was just created

Describe mount targets:

```bash
$ aws efs describe-mount-targets \
--file-system-id file-system-id \
--region aws-region \
--profile dev
```

#### 2. Mount the elastic file system on a Linux instance using the steps below:
    - A secure method to mount a file system from a EC2 instance is by encrypting data in transit
    - You can use EFS Mount Helper to connect to your file system via TLS

    a. Connect to you EC2 linux instance via session manager and AWS CLI

    ```bash
    aws ssm start-session --target i-InstanceID
    Starting session with SessionId: MASCOT-XXXX
    sh-4.2$
    ```

    b. You will need to install amazon-efs-utils package to use the mount helper for encrypting data in transit

    Note:
    By default, when using the Amazon EFS mount helper with Transport Layer Security (TLS), the mount helper enforces the use of the Online Certificate Status Protocol (OCSP) and certificate hostname checking. The Amazon EFS mount helper uses the stunnel program for its TLS functionality. Some versions of Linux don't include a version of stunnel that supports these TLS features by default. When using one of those Linux versions, mounting an Amazon EFS file system using TLS fails.

    ```bash
    sudo yum install -y amazon-efs-utils
    Installed:
        amazon-efs-utils.noarch 0:1.5-1.amzn1                                         
    Dependency Installed:
        stunnel.x86_64 0:4.56-4.13.amzn1                                              
    Complete!
    ```

    c. For Stunnel certificate validation check, stunnel will make a HTTP request to the URL's noted in the References section below. If the certificate validation check is blocked, you will see the following error:

    ```bash
    sh-4.2$ sudo mount -t efs -o tls fs-filesystemid.efs.us-west-2.amazonaws.com:/ /mnt/TestEFS
    mount.nfs4: Connection reset by peer
    Failed to initialize TLS tunnel for fs-filesystemID
    ```

    You can optionally disable OCSP and certificate hostname checking inside the Amazon EFS mount helper configuration by following the below steps:

        1. Using your text editor of choice, open the /etc/amazon/efs/efs-utils.conf file.
        2. Set the stunnel_check_cert_hostname value to false.
        3. Set the stunnel_check_cert_validity value to false.
        4. Save the changes to the file and close it.

    d. Mount the file system on your EC2 instance

    ```bash
    sh-4.2$ cd /mnt
    sh-4.2$ sudo mkdir TestEFS
    sh-4.2$ sudo mount -t efs -o tls fs-filesystemid.efs.us-west-2.amazonaws.com:/ /mnt/TestEFS
    sh-4.2$ df -h
        Filesystem      Size  Used Avail Use% Mounted on
        devtmpfs        470M   60K  470M   1% /dev
        tmpfs           480M     0  480M   0% /dev/shm
        /dev/nvme0n1p1  7.8G  1.9G  5.9G  25% /
        127.0.0.1:/     8.0E     0  8.0E   0% /mnt/TestEFS
    ```

    e. Now that you have the Amazon EFS file system mounted on your EC2 instance, you can create files

    Change the directory

    ```bash
    sh-4.2$ cd /mnt/TestEFS
    ```

    List the directory contents

    ```bash
    sh-4.2$ ls -al
    total 4
    drwxr-xr-x 2 root root 6144 Feb  4 17:58 .
    drwxr-xr-x 3 root root   21 Feb  5 00:19 ..
    ```

    The root directory of a file system, upon creation, is owned by and is writable by the root user, so you need to change permissions to add files.

    ```bash
    sh-4.2$  sudo chmod go+rw .
    ```

    Now, if you try the ls -al command you see that the permissions have changed.

    ```bash
    total 4
    drwxrwxrwx 2 root root 6144 Feb  4 17:58 .
    drwxr-xr-x 3 root root   21 Feb  5 00:19 ..
    ```

    Now you can create a sample file on the mounted file system and unmount when completed.

    ```bash
    sh-4.2$  touch test-file.txt
    sh-4.2 ls -al
    total 8
    drwxrwxrwx 2 root     root     6144 Feb  5 00:22 .
    drwxr-xr-x 3 root     root       21 Feb  5 00:19 ..
    -rw-r--r-- 1 ssm-user ssm-user    0 Feb  5 00:22 test-file.txt
    sh-4.2$ vi test-file.txt
    sh-4.2$ cat test-file.txt
    Hello-World
    sh-4.2$ cd /
    sh-4.2$ sudo umount /mnt/TestEFS
    sh-4.2$ df -h
    Filesystem      Size  Used Avail Use% Mounted on
    devtmpfs        463M     0  463M   0% /dev
    tmpfs           480M     0  480M   0% /dev/shm
    tmpfs           480M  324K  480M   1% /run
    tmpfs           480M     0  480M   0% /sys/fs/cgroup
    /dev/nvme0n1p1  8.0G  1.8G  6.3G  23% /
    ```

#### 3. User and Group ID permissions for files and directories within a file system

    Files and directories in an Amazon EFS file system support standard Unix-style read, write, and execute permissions based on the user ID and group ID asserted by the mounting NFSv4.1 client. When users attempt to access files and directories, Amazon EFS checks their user IDs and group IDs to verify that each user has permission to access the objects. Amazon EFS also uses these IDs to indicate the owner and group owner for new files and directories that the user creates. Amazon EFS doesn't examine user or group names—it only uses the numeric identifiers.

    If a user accesses an Amazon EFS file system from two different EC2 instances, depending on whether the UID for the user is the same or different on those instances you see different behavior, as follows:

    * If the user IDs are the same on both EC2 instances, Amazon EFS considers them to indicate the same user, regardless of the EC2 instance used. The user experience when accessing the file system is the same from both EC2 instances.
    * If the user IDs aren't the same on both EC2 instances, Amazon EFS considers the users to be different users. The user experience isn't the same when accessing the Amazon EFS file system from the two different EC2 instances.
    * If two different users on different EC2 instances share an ID, Amazon EFS considers them to be the same user.

    Users can check their ID as follows:

    ```bash
    sh-4.2$ id
    uid=501(ssm-user) gid=501(ssm-user) groups=501(ssm-user)
    ```

#### References:

https://docs.aws.amazon.com/efs/latest/ug/accessing-fs.html

https://docs.aws.amazon.com/efs/latest/ug/using-amazon-efs-utils.html

URL's used by stunnel for OCSP certificate validation checks:

http://ocsp.sca1b.amazontrust.com/
http://ocsp.rootca1.amazontrust.com/
http://ocsp.rootg2.amazontrust.com/
http://o.ss2.us/
