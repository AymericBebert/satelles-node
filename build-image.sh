#!/usr/bin/env bash

BUILD_CONFIGURATION=$1

if [ -z $BUILD_CONFIGURATION ]
then
  read -p "Enter build configuration [PRODUCTION/testing]: " bc
  BUILD_CONFIGURATION=${bc:-production}
fi

tags=`git describe --contains`

if [ -z $tags ]
then
  echo "No tag on current commit. Latest tags:"
  git tag | sort -V | tail -n 3

  read -p "Enter new tag: " newtag

  [ -z "$newtag" ] && echo "No version specified" && exit 1

  if ! git tag $newtag
  then
    read -p "Git tag failed, continue? [y/N]: " c
    if [[ ! $c =~ ^[Yy]$ ]]
    then
      echo "Cancelled"
      exit 2
    fi
  fi
else
  if [[ $tags == *" "* ]]
  then
    echo "Ambiguous tag. Aborting."
    exit 1
  else
    echo "Using git tag"
    newtag=$tags
  fi
fi

version=$newtag
if [ "$BUILD_CONFIGURATION" != "production" ]
then
  version=$newtag-$BUILD_CONFIGURATION
fi

read -p "Will build version $version, configuration $BUILD_CONFIGURATION, continue? [y/N]: " c
if [[ ! $c =~ ^[Yy]$ ]]
then
  echo "Cancelled"
  exit 2
fi

echo "Building satelles-node:$version..."
docker build -t aymericbernard/satelles-node:$version --build-arg BUILD_CONFIGURATION=$BUILD_CONFIGURATION --build-arg VERSION=$version . || { echo 'build failed' ; exit 1; }

echo "Pushing satelles-node:$version to docker registry..."
docker push aymericbernard/satelles-node:$version || { echo 'push failed' ; exit 1; }

echo "Pushing git tags..."
git push --tags
