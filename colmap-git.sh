#!/bin/bash

# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ #
# ~~~~~~~~~~~~~~~~~~~~ COLAMP git server bash ~~~~~~~~~~~~~~~~~~~~~ #
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ #
#
# This script can be used to run colmap (or petentialy any script) on 
# a remote server. The script uses ssh and git remotes to share files
# and run commands remotly. The stdout and stderr will be logger to a 
# file called "output.log". Once the script runs the working repo will
# be pushed to the server, thee run script be executed finaly all 
# changes will be commited and pushed back to the local repo.
#
# ~~~~~~~~~~~~~~~~~~~~~~~~~~ How to use ~~~~~~~~~~~~~~~~~~~~~~~~~~~ #
# 1 - Create a git repository with all files needed for your script
# 2 - Create a script called "run.sh" in the repository. This script
#     will be run on the server from the directory of the repository.
# 3 - Create another script in the repo called "config.sh". In this script
#      you must  define the following variables:
#           REMOTE_USER: your SSH username e.g. "root"
#           REMOTE_PORT: your SSH port e.g. 1234
#           REMOTE_HOST: your Server address e.g. "123.12.34.567" 
#
# 4 - Insure your server is live (this script will check if it isn't)
# 5 - Run this script from within the repository.

# Retreive configuration
source ./config.sh

# Computed variables
REPO_NAME=${PWD##*/}          # to assign to a variable
REPO_NAME=${REPO_NAME:-/}        # to correct for the case where PWD is / (root)
REMOTE_REPO_PATH="/workspace/$REPO_NAME" # Change to desired repo path on server
REMOTE_REPO_WORK_PATH="/workspace/$REPO_NAME-working" # Change to desired repo path on server
BRANCH="main"                    # Change to the correct branch if needed

# Colorful logger / error
Red='0;31'
Pink='38;2;255;185;230'
NC='0m' # No Color
log () { 
    printf "\n\033[${Pink}m************ $1 ************\033[${NC}\n\n"; 
}
error () { 
    printf "\n\033[${Red}m************ $1 ************\033[${NC}\n\n"; 
}

# Add ssh agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa

# Check there is indeed a git repo.
if [ ! -d "./.git" ]; then
    error "Error: No Git repository found."
    exit 1
else
    log "Server run for repo ${REPO_NAME}"
fi

log "Checking Connection"

# Check SSH connection and if working repo has already been setup
ssh -q -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "[ -d \"$REMOTE_REPO_WORK_PATH/.git\" ]"
SSH_STATUS=$? 
if [ $SSH_STATUS -eq 255 ]; then
    error "Failed to connect to server $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT"
    exit 1
elif [ $SSH_STATUS -gt 0 ]; then
    # Configure git user on remote server and create a bare git repository on the remote server.
    log "Remote git setup $REMOTE_REPO_PATH"
    ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "git config --global user.name gltralph && git config --global user.email gltralph@gmial.com && git config --global init.defaultBranch $BRANCH && mkdir -p $REMOTE_REPO_PATH && cd $REMOTE_REPO_PATH && git init --bare"
fi


# Check that git remote doesn't already exist
# if the remote doesn't exist or is incorrect create a new remote.
REMOTE_URL="ssh://$REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT/$REMOTE_REPO_PATH"
if [ "$(git config --get remote.Server.url)" != $REMOTE_URL ]; then
    # Add git remote to the server
    log "Adding remote 'Server'"
    git remote remove Server > /dev/null 2>&1 # Remove any remote server previously setup
    git remote add Server "ssh://$REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT/$REMOTE_REPO_PATH" 
fi


# Stage, commit and push the local repository to the remote.
log "Pushing to remote server"
git add .                           # Add any changes made to the local repo
git commit -m "ready for server"    # Commit changes
git push -u Server "$BRANCH"        # Push to the live server


# Clone the git repository to a working copy on the server
# if there isn't one already.
if [ $SSH_STATUS -gt 0 ]; then
    log "Creating working copy repo $REMOTE_REPO_WORK_PATH"
    ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_REPO_PATH && git symbolic-ref HEAD refs/heads/$BRANCH && git clone $REMOTE_REPO_PATH $REMOTE_REPO_WORK_PATH"
else
    log "Pulling repo $REMOTE_REPO_WORK_PATH"
    ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_REPO_WORK_PATH && git config pull.rebase false && git pull"

fi


# execute repo script
log "Running 'run.sh' script on the remote server"
ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_REPO_WORK_PATH && sh ./run.sh"

log "Pushing remote changes"
ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_REPO_WORK_PATH && git add . && git commit -m 'run process' && git push origin $BRANCH"

# Pull the changes back 
log "Pulling remote changes"
git pull Server "$BRANCH"

log "Remote run complete"