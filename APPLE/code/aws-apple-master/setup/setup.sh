#!/bin/bash

set -e

# Set required variables
AWS_CONFIG_FILE=~/.aws/config
PROFILE_FILE=~/.aws_profile
BACKUP_FILE="bak.$(date +%s)"

# detect where the aws-apple directory is, based on this script.
AWS_APPLE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"

function usage() {
    echo "Usage: $0 [options]"
    echo " -u, --user             user's AppleID"
    echo " -m, --mascot-role      AWS mascot role"
    echo " -d, --dev-account-id   AWS developer account id"
    echo " -t, --test-account-id  AWS test account id"
    echo " -p, --prod-account-id  AWS production account id"
    echo " -f, --file             Response file for prompts in this script; used for non-interactive use as an alternative to command-line args"
    echo "                        Values in the file take precedence over command-line arguments."
    echo " --profile-prefix       Prefix to use when defining AWS profiles"
    echo " --use-aws-ps1          A boolean value to enable/disable a modified PS1"
}

function getInput() {
    prompt="$1"
    variableName="$2"
    variableValue="$(eval "echo \$$2")"

    echo -n "$prompt"
    if [ -z "$variableValue" ]; then
      read "$variableName"
    elif [ "$variableValue" == "SKIP" ]; then
      eval "$variableName="
      echo ""
    else
      echo "$variableValue"
    fi
}

function brew_install() {
  brew install $1 || true
  brew unlink $1
  brew link $1 --overwrite
}

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --user|-u )
      appleconnect_username="$2"
      ;;
    --mascot-role|-m )
      mascot_role="$2"
      ;;
    --dev-account-id|-d )
      aws_dev_account_id="$2"
      ;;
    --test-account-id|-t )
      aws_test_account_id="$2"
      ;;
    --prod-account-id|-p )
      aws_prod_account_id="$2"
      ;;
    --file|-f )
      responses_file="$2"
      ;;
    --profile-prefix )
      profile_prefix="$2"
      ;;
    --use-aws-ps1 )
      use_aws_ps1="$2"
      ;;
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
  shift
done

if [ -n "$responses_file" ] && [ -f "$responses_file" ]; then
  source $responses_file
fi

# Gather user input
echo -e "\n== AWS@Apple Setup ==\n"
echo "In order to configure your AWS CLI access, we'll need to gather some information "
echo "from you. If you have any questions, go to: "
echo "https://github.pie.apple.com/CloudTech/aws-apple/blob/master/setup"
echo
getInput "Enter your AppleConnect username (ex. john_smith): " appleconnect_username
echo "In particular, to find your role and account IDs, go to: "
echo "https://portal.aws.ais.apple.com/console-access"
echo
getInput "Enter the MASCOT role name (ex. developer_role): " mascot_role
echo
echo "Now you'll need to enter the AWS Account IDs for your accounts. Typically customers"
echo "have Dev, Test, and Prod accounts. If you don't, just press enter."
getInput "Enter your Dev AWS Account ID (ex. 123456789012): " aws_dev_account_id
getInput "Enter your Test AWS Account ID (ex. 234567890123): " aws_test_account_id
getInput "Enter your Prod AWS Account ID (ex. 345678901234): " aws_prod_account_id
echo
echo "Would you like to append the AWS environment (i.e. [dev]) to your BASH "
echo "prompt? We think most people should set this to true, however if you "
echo "use a customized PS1 setting, set this to false."
getInput "Use the recommended PS1 setting (choose true or false): " use_aws_ps1
echo
echo "If you would like to name your profiles, you can set an optional prefix. If not, just"
echo "press enter, and we'll label your accounts 'dev', 'test', and 'prod'."
getInput "(Optional) Enter your preferred profile name prefix (ex. mascot-): " profile_prefix

echo -e "\n== AWS@Apple Brew Configuration =="
if [ ! -x "$(command -v brew)" ]; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
fi
PREFIX=$(brew --prefix)
# Using a bundle instead of a regular install will not error out if you already
# have the packages installed.
brew bundle --file=- <<-EOF
brew "bash-completion"
brew "jq"
brew "python3"
EOF
echo "✅  prerequisite installations are complete!"

echo -e "\n== Python3 Configuration =="
brew_install awscli
echo "✅  awscli installation is complete!"

echo -e "\n== AWS@Apple AppleConnect Plugin Install =="
brew tap cloudtech/tap git@github.pie.apple.com:cloudtech/homebrew-tap.git
brew_install awsappleconnect
echo "✅  awsappleconnect installation is complete!"

echo -e "\n== AWS@Apple AWS Login Install =="
brew_install aws-login
echo "✅  aws-login installation is complete!"

# AWS Bash Profile
echo -e "\n== AWS@Apple AWS Profile Install =="
set +e
if [ "$SHELL" = "/bin/zsh" ]; then
PROFILE=~/.zprofile
else
PROFILE=~/.profile
fi
/usr/bin/grep -q "export USE_AWS_PS1" $PROFILE 2> /dev/null || echo "export USE_AWS_PS1=$use_aws_ps1" >> $PROFILE
/usr/bin/grep -q "source $HOME/\.aws_profile" $PROFILE 2> /dev/null || echo "source $PROFILE_FILE" >> $PROFILE
/usr/bin/grep -q "source $HOME/\.profile" ~/.bash_profile 2> /dev/null || echo "source $HOME/.profile" >> ~/.bash_profile
set -e

if [ -n "`$SHELL -c 'echo $BASH_VERSION'`" ]; then
  cat << 'EOF' > $PROFILE_FILE
# --------------------------------------------------------------------------------
# Set default profile
# --------------------------------------------------------------------------------

export AWS_DEFAULT_REGION="us-west-2"

# --------------------------------------------------------------------------------
# Use Homebrew's bash autocompletion
# --------------------------------------------------------------------------------

if [ -f $(brew --prefix)/etc/bash_completion ]; then
  . $(brew --prefix)/etc/bash_completion
fi

# --------------------------------------------------------------------------------
# Use AWSCLI completion if it exists (bash-only)
# --------------------------------------------------------------------------------

if [[ $(which aws_completer) ]]; then
  complete -C $(which aws_completer) aws
fi

# --------------------------------------------------------------------------------
# Include AWS_DEFAULT_PROFILE in prompt
# --------------------------------------------------------------------------------

if [[ $USE_AWS_PS1 == true ]]; then
  prompt() {
    if [[ "$AWS_PROFILE" ]]; then
      PROMPT="\h:\W \u [\$AWS_PROFILE]\$ "
      PS1="$PROMPT"
    fi
  }
  PROMPT_COMMAND=prompt
fi

# --------------------------------------------------------------------------------
# Bash function for changing AWS profiles
# --------------------------------------------------------------------------------

aws-profile() {
  if [[ "$1" == "clear" ]]; then
    unset AWS_PROFILE
  else
    export AWS_PROFILE="$1"
  fi
}
EOF
fi
if [ -n "`$SHELL -c 'echo $ZSH_VERSION'`" ]; then
  cat << 'EOF' > $PROFILE_FILE
# --------------------------------------------------------------------------------
# Set default profile
# --------------------------------------------------------------------------------

export AWS_DEFAULT_REGION="us-west-2"

# --------------------------------------------------------------------------------
# Use AWSCLI completion if it exists (zsh-only)
# --------------------------------------------------------------------------------

if [ -f $(brew --prefix)/bin/aws_zsh_completer.sh ] ; then
  autoload -Uz compinit && compinit
  source $(brew --prefix)/bin/aws_zsh_completer.sh
fi

# --------------------------------------------------------------------------------
# Include AWS_DEFAULT_PROFILE in prompt
# --------------------------------------------------------------------------------

# NOTE: This does not work if you use a ZSH_THEME with OhMyZsh.
# Create your own theme to incorporate AWS_PROFILE if you would like this functionality.
# https://github.com/robbyrussell/oh-my-zsh/wiki/Customization#overriding-and-adding-themes
precmd() {
  if [[ "$AWS_PROFILE" ]] && [[ $USE_AWS_PS1 == true ]]; then
    PROMPT="%m:%d %n [\$AWS_PROFILE]\$ "
    PS1="$PROMPT"
  fi
}

# --------------------------------------------------------------------------------
# Zsh function for changing AWS profiles
# --------------------------------------------------------------------------------

aws-profile() {
  if [[ "$1" == "clear" ]]; then
    unset AWS_PROFILE
  else
    export AWS_PROFILE="$1"
  fi
}
EOF
fi
echo "✅  ~/.aws_profile installation is complete!"

cat << 'EOF' > $PREFIX/etc/bash_completion.d/aws-profile
_aws_profile()
{
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    opts="$(egrep -o "\[profile (\S+)\]" ~/.aws/config | cut -d" " -f2 | cut -d']' -f1 | tr "\n" " ") clear"

    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
    return 0
}
complete -F _aws_profile aws-profile
EOF
chmod +x $PREFIX/etc/bash_completion.d/aws-profile
echo "✅  aws-profile bash completion installation is complete!"

# AWS Config
echo -e "\n== AWS@Apple AWS Configuration Install =="

# Create the config file if it doesn't already exist
if [ ! -f $AWS_CONFIG_FILE ]; then
    mkdir -p $(dirname $AWS_CONFIG_FILE)
    touch $AWS_CONFIG_FILE
    echo "✅  creating $AWS_CONFIG_FILE!"
fi

set +e
/usr/bin/grep -q "\[profile ${profile_prefix}dev\]" $AWS_CONFIG_FILE
if [ $? -ne 0 -a ! -z "$aws_dev_account_id" ]; then
    echo -e "\n[profile ${profile_prefix}dev]\ncredential_process = awsappleconnect -u $appleconnect_username -a $aws_dev_account_id -r $mascot_role\nregion = us-west-2" >> $AWS_CONFIG_FILE
    echo "✅  added profile ${profile_prefix}dev!"
fi

/usr/bin/grep -q "\[profile ${profile_prefix}test\]" $AWS_CONFIG_FILE
if [ $? -ne 0 -a ! -z "$aws_test_account_id" ]; then
    echo -e "\n[profile ${profile_prefix}test]\ncredential_process = awsappleconnect -u $appleconnect_username -a $aws_test_account_id -r $mascot_role\nregion = us-west-2" >> $AWS_CONFIG_FILE
    echo "✅  added profile ${profile_prefix}test!"
fi

/usr/bin/grep -q "\[profile ${profile_prefix}prod\]" $AWS_CONFIG_FILE
if [ $? -ne 0 -a ! -z "$aws_prod_account_id" ]; then
    echo -e "\n[profile ${profile_prefix}prod]\ncredential_process = awsappleconnect -u $appleconnect_username -a $aws_prod_account_id -r $mascot_role\nregion = us-west-2" >> $AWS_CONFIG_FILE
    echo "✅  added profile ${profile_prefix}prod!"
fi
echo "✅  ~/.aws/config installation is complete!"
set -e

echo -e "\n== AWS@Apple AWS SSM Session Manager CLI Plugin Install =="
brew_install aws-session-manager-plugin
echo "✅  SSM Session Manager CLI Plugin installation is complete!"

echo -e "\n== AWS@Apple Setup Complete! =="
echo "You are ready to use AWS the AIS way!"
echo
echo "To test your access simply enter the following commands:"
echo "   $ source $PROFILE"
echo "   $ aws-profile ${profile_prefix}dev"
echo "   [dev]$ aws sts get-caller-identity"
echo "   [dev]$ aws-login"
echo
echo "If you have any questions please refer to:"
echo "https://github.pie.apple.com/CloudTech/aws-apple/blob/master/setup"
