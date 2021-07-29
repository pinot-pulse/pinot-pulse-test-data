data "aws_cloudformation_export" "ais_shared_services_security_group" {
  name = "ais-shared-services-sg-SS-SG"
}

variable "images" {
  type = map
  default = {
    "1.18" = "/AIS/AMI/AmazonEKS18Linux/Id"
    "1.17" = "/AIS/AMI/AmazonEKS17Linux/Id"
    "1.16" = "/AIS/AMI/AmazonEKS16Linux/Id"
    "1.15" = "/AIS/AMI/AmazonEKS15Linux/Id"
  }
}

data "aws_ssm_parameter" "eks_image" {
  name = lookup(var.images, var.eks_version)
}

resource "aws_security_group" "node_sg" {
  name        = "${var.eks_cluster_name}-tf-node_sg"
  description = "Security group for all nodes in the cluster"
  vpc_id      = data.aws_cloudformation_export.vpc_id.value

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "owned",
  }
}

resource "aws_security_group_rule" "node_sg_ingress" {
  type                     = "ingress"
  description              = "Allow node to communicate with each other"
  security_group_id        = aws_security_group.node_sg.id
  source_security_group_id = aws_security_group.node_sg.id
  protocol                 = "-1"
  from_port                = 0
  to_port                  = 65535
}

resource "aws_security_group_rule" "node_sg_from_control_plane_ingress" {
  type                     = "ingress"
  description              = "Allow worker Kubelets and pods to receive communication from the cluster control plane"
  security_group_id        = aws_security_group.node_sg.id
  source_security_group_id = aws_security_group.cluster_control_plane_sg.id
  protocol                 = "tcp"
  from_port                = 1025
  to_port                  = 65535
}

resource "aws_security_group_rule" "control_plane_egress_to_node_sg" {
  type                     = "egress"
  description              = "Allow the cluster control plane to communicate with worker Kubelet and pods"
  security_group_id        = aws_security_group.cluster_control_plane_sg.id
  source_security_group_id = aws_security_group.node_sg.id
  protocol                 = "tcp"
  from_port                = 1025
  to_port                  = 65535
}

resource "aws_security_group_rule" "node_sg_from_control_plane_on_443_ingress" {
  type                     = "ingress"
  description              = "Allow pods running extension API servers on port 443 to receive communication from cluster control plane"
  security_group_id        = aws_security_group.node_sg.id
  source_security_group_id = aws_security_group.cluster_control_plane_sg.id
  protocol                 = "tcp"
  from_port                = 443
  to_port                  = 443
}

resource "aws_security_group_rule" "control_plane_egress_to_node_sg_on_443" {
  type                     = "egress"
  description              = "Allow the cluster control plane to communicate with pods running extension API servers on port 443"
  security_group_id        = aws_security_group.cluster_control_plane_sg.id
  source_security_group_id = aws_security_group.node_sg.id
  protocol                 = "tcp"
  from_port                = 443
  to_port                  = 443
}

resource "aws_security_group_rule" "cluster_control_plane_sg_ingress" {
  type                     = "ingress"
  description              = "Allow pods to communicate with the cluster API Server"
  security_group_id        = aws_security_group.cluster_control_plane_sg.id
  source_security_group_id = aws_security_group.node_sg.id
  protocol                 = "tcp"
  from_port                = 443
  to_port                  = 443
}

data "template_file" "eks" {
  template = file("${path.module}/userdata/eks.sh")
  vars = {
    cluster_name = var.eks_cluster_name
    aws_region   = var.aws_region
  }
}

data "template_cloudinit_config" "config" {
  gzip          = false
  base64_encode = true
  part {
    content_type = "text/x-shellscript"
    content      = data.template_file.eks.rendered
  }
}

resource "aws_launch_configuration" "node_launch_config" {
  name_prefix                 = "${var.eks_cluster_name}-tf-node_launch_config-"
  associate_public_ip_address = false
  iam_instance_profile        = aws_iam_instance_profile.node_instance_profile.arn
  image_id                    = data.aws_ssm_parameter.eks_image.value
  instance_type               = var.eks_instance_type
  user_data_base64            = data.template_cloudinit_config.config.rendered

  security_groups = [
    aws_security_group.node_sg.id,
    data.aws_cloudformation_export.ais_shared_services_security_group.value
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "node_group" {
  name                 = "${var.eks_cluster_name}-tf-node_group"
  desired_capacity     = var.eks_desired_capacity
  launch_configuration = aws_launch_configuration.node_launch_config.id
  max_size             = var.eks_max_size
  min_size             = var.eks_min_size
  vpc_zone_identifier = [
    data.aws_cloudformation_export.privatesubnet1_id.value,
    data.aws_cloudformation_export.privatesubnet2_id.value,
    data.aws_cloudformation_export.privatesubnet3_id.value
  ]

  tags = [
    {
      key                 = "Name"
      value               = "${var.eks_cluster_name}-workergroup-node"
      propagate_at_launch = true
    },
    {
      key                 = "kubernetes.io/cluster/${var.eks_cluster_name}"
      value               = "owned"
      propagate_at_launch = true
    },
    {
      key                 = "k8s.io/cluster-autoscaler/${var.eks_cluster_name}"
      value               = "owned"
      propagate_at_launch = true
    },
    {
      key                 = "k8s.io/cluster-autoscaler/enabled"
      value               = "true"
      propagate_at_launch = true
    }
  ]

  depends_on = [aws_eks_cluster.eks_cluster]
}
