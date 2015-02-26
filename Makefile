distribute-win32: release/build/distrib/resin-cli-win32.zip
distribute-darwin: release/build/distrib/resin-cli-darwin.tar.gz
distribute-linux: release/build/distrib/resin-cli-linux.tar.gz

installer-win32: release/build/distrib/resin-cli-setup.exe

release/build/resin-cli-%:
	mkdir -p $@
	cp -rf bin build package.json $@ && rm -rf $@/bin/node
	cd $@ && RESIN_BUNDLE=$(subst resin-cli-,,`basename $@`) npm install --production --force
	flatten-packages $@

release/build/distrib/resin-cli-win32.zip: release/build/resin-cli-win32
	mkdir -p `dirname $@`
	cd $< && zip -r ../../../$@ .

release/build/distrib/resin-cli-darwin.tar.gz: release/build/resin-cli-darwin
	mkdir -p `dirname $@`
	tar fcz $@ -C `dirname $<` `basename $<`

release/build/distrib/resin-cli-linux.tar.gz: release/build/resin-cli-linux
	mkdir -p `dirname $@`
	tar fcz $@ -C `dirname $<` `basename $<`

release/build/distrib/resin-cli-setup.exe: release/installers/win32/resin-cli.nsi release/build/distrib/resin-cli-win32.zip
	makensis $<

clean:
	rm -rf release/build
