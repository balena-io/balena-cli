#!/bin/sh

OUTPUT=$1
INPUT=$2

for file in $INPUT/*.coffee; do

	# Omit this unecessary files
	if [ `basename "$file"` == 'index.coffee' ] || [ `basename "$file"` == 'command-options.coffee' ]; then
		continue
	fi

	filename=`basename "${file%.*}"`
	output=$OUTPUT/$filename
	mkdir -p $output
	./node_modules/coffee-script/bin/coffee extras/capitano-doc/index.coffee markdown "$file" "$output"
	echo "[CapitanoDoc] Processed $file to $output"
done
