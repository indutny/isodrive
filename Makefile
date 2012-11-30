all: lib lib-dev

lib:
	node_modules/.bin/browserbuild -g Isodrive -m ui -b lib/ lib > \
		dist/isodrive.js
	node_modules/.bin/uglifyjs dist/isodrive.js -m -c > dist/isodrive.min.js

lib-dev:
	node_modules/.bin/browserbuild -d -g Isodrive -m isodrive -b lib/ lib > \
		dist/isodrive-dev.js

.PHONY: all lib lib-dev
