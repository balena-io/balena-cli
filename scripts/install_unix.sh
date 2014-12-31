#!/usr/bin/env bash

NODE=node
RESIN=resin
NPM=npm
RESIN_PACKAGE=resin

function print() {
	echo "---> $1"
}

function missingProgram() {
	! hash $1 2>/dev/null
}

function hasProgram() {
	hash $1 2>/dev/null
}

function missingNode() {
	missingProgram $NODE || missingProgram $NPM
}

function isDarwin() {
	[ "$(uname)" == "Darwin" ]
}

function isLinux() {
	[ "$(expr substr $(uname -s) 1 5)" == "Linux" ]
}

function isFreeBSD() {
	[ "$(uname)" == "FreeBSD" ]
}

echo "Installing resin.io command line utility"
echo ""

if hasProgram $RESIN; then
	print "Resin is already installed in this system."
	exit 0
fi

if isDarwin; then

	print "Darwin system detected"

	if missingNode && hasProgram brew; then
		print "Trying to install node from brew"
		brew install node
	fi

	if missingNode && hasProgram fink; then
		print "Trying to install nodejs from fink"
		fink install nodejs
	fi

	if missingNode && hasProgram port; then
		print "Trying to install nodejs from MacPorts (requires admin privileges)"
		port -v install nodejs
	fi

elif isLinux; then

	print "GNU/Linux system detected"

	# Ubuntu 10.04, 12.04, 14.04.
	# Debian Wheezy, Jessie, Sid.
	# Linux Mint Maya, Qiana, Debian Edition.
	# Elementary OS Luna, Freya.
	if missingNode && hasProgram apt-get; then
		print "Trying to install nodejs from apt-get (requires admin privileges)"
		curl -sL https://deb.nodesource.com/setup | bash - && apt-get install -y nodejs
	fi

	# RHEL 5, 6, 7.
	# CentOS 5, 6, 7.
	# Fedora Heisenbug, Schrödinger's Cat.
	# Oracle Linux.
	# Amazon Linux.
	if missingNode && hasProgram yum; then
		print "Trying to install nodejs from yum (requires admin privileges)"
		curl -sL https://deb.nodesource.com/setup | bash - && yum install -y nodejs
	fi

	# Arch Linux
	if missingNode && hasProgram pacman; then
		print "Trying to install nodejs from pacman (requires admin privileges)"
		pacman -S nodejs
	fi

	# Gentoo
	if missingNode && hasProgram emerge; then
		print "Trying to install nodejs from emerge (requires admin privileges)"
		emerge nodejs
	fi

elif isFreeBSD; then

	print "FreeBSD system detected"

	if missingNode && hasProgram pkg_add; then
		print "Trying to install node from pkg_add (requires admin privileges)"
		pkg_add -r node
	fi

	if missingNode && hasProgram pkg; then
		print "Trying to install node from pkg-ng (requires admin privileges)"
		pkg install node
	fi

else
	print "Unsupported operating system"
fi

if missingNode; then
	print "Unable to install node on this system."
	print ""
	print "Please go to http://nodejs.org/download/ and re-run this script once node has been installed."
	exit 1
else
	$NPM install -g $RESIN_PACKAGE
	print "Installation completed."
fi
