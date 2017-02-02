L.Control.GmxTimelineVisjs = L.Control.extend({
    includes: L.Mixin.Events,
    options: {
        position: 'bottom',
        id: 'gmxTimelineVisjs',
        className: 'gmxTimelineVisjs',
		// dataSources: [
			// {layerID: '636CBFF5155F4F299254EAF54079040C', temporalColumnName: 'acqdate', clouds: {key: 'clouds', lt: 30}} //,	// RC_Sentinel-2A_432_new
			// {layerID: '61F54CF35EC44536B527A2168BE6F5A0', temporalColumnName: 'acqdate'},	// QL_Sentinel-2
			// {layerID: '8EE2C7996800458AAF70BABB43321FA4'}	// AIS
		// ],
		hostPrefix: 'http://maps.kosmosnimki.ru/',
		dateInterval: [new Date('2016-01-01'), new Date('2016-12-31')],
        draggable: true
    },

	initialize: function (options) {
		L.Control.prototype.initialize.call(this, options);
		this._defaults = {
			zeroDate: new Date(1980, 0, 1)
		};
	},

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.off('moveend', this._moveend, this);
        map.fire('controlremove', this);
        // var corners = map._controlCorners;
        // ['bottomleft', 'bottomright', 'right', 'left'].map(function (it) {
            // if (corners[it]) {
                // L.DomUtil.removeClass(corners[it], 'gmx-bottom-shift');
            // }
        // });
    },
/*
    _getLayersPromise: function () {
		if (!this._layersPropsPromise) {
			var _this = this;
			var arr = this.options.dataSources.map(function (it) {
				return {Layer: it.layerID};
			});
			this._layersPropsPromise = fetch(this.options.hostPrefix + 'Layer/GetLayerJson.ashx?WrapStyle=None&Layers=' + JSON.stringify(arr))
				.then(function(response) { return response.json(); })
				.then(function(json) {
console.log('_ssss_', json)
					if (json.Status === 'ok' && json.Result.values.length) {
						json.Result.values.forEach(function (it, i) {
							var props = it.properties;
							_this._layersProps[props.name] = {
								temporalColumnName: props.TemporalColumnName
							};
// select count(*) as content, [acqdate] as start from [AFB4D363768E4C5FAC71C9B0C6F7B2F4] WHERE Intersects([geomixergeojson], buffer(GeometryFromGeoJson('{"type":"GeometryCollection","geometries":[{"type":"Polygon","coordinates":[[[37.9248046875,55.547280698640805],[37.9248046875,56.12106052504407],[37.254638671875,56.12106052504407],[37.254638671875,55.547280698640805],[37.9248046875,55.547280698640805]]]}]}', 4326), 0.001)) AND [cloudness] < 30 AND [acqdate] BETWEEN '2016-01-01' AND '2016-12-31' GROUP BY [acqdate]
						});
						// resolve(_this._layersProps);
					console.log('items: ', data.length, ' objects: ', counts);
					}
				});
	  // this._layersPropsPromise = new Promise(function (resolve, reject) {
			// var // hostPrefix + 'VectorLayer/QuerySelect?sql=select count(*) from [61F54CF35EC44536B527A2168BE6F5A0]'
			// Layers - JSON массив с параметрами [{“Layer”:”id layer”,”dateBegin”:xxx,”dateEnd”:xxxx}]
// console.log('__', it.min)
		}
			
			// 
		// }
		// var // http://maps.kosmosnimki.ru/VectorLayer/QuerySelect?sql=select count(*) from [61F54CF35EC44536B527A2168BE6F5A0]
		// hostPrefix + 'VectorLayer/QuerySelect?sql=select count(*) from [61F54CF35EC44536B527A2168BE6F5A0]'
		return this._layersPropsPromise;
    },
*/
    _moveend: function (ev) {
		if (this._sidebarOn) {
			this._bboxUpdate(ev);
		}
    },

    _bboxUpdate: function () {
		var bboxs = L.gmxUtil.getNormalizeBounds(map.getBounds());
			geometries = bboxs.map(function (it) {
				return {
					type: 'Polygon',
					coordinates: [[[it.min.x, it.max.y], [it.max.x, it.max.y], [it.max.x, it.min.y], [it.min.x, it.min.y], [it.min.x, it.max.y]]]
				};
			});

		var arr = [],
			ids = [],
			_this = this,
			geoIntersects = 'Intersects([geomixergeojson], buffer(GeometryFromGeoJson(\'{"type":"GeometryCollection","geometries":' + JSON.stringify(geometries) + '}\', 4326), 0.001))',
			prefix = this.options.hostPrefix + 'VectorLayer/QuerySelect?WrapStyle=None&sql=select count(*) as content',
			between = '\'' + this._getDateInterval(true).join('\' AND \'') + '\'';
			// ,
			// bbox = ',min(STEnvelopeMinX([gmx_geometry])) as xmin';
		// bbox += ',max(STEnvelopeMaxX([gmx_geometry])) as xmax';
		// bbox += ',min(STEnvelopeMinY([gmx_geometry])) as ymin';
		// bbox += ',max(STEnvelopeMaxY([gmx_geometry])) as ymax';

		this._items.clear();
		var count = 0;
		this.options.dataSources.forEach(function (it) {
			if (it.layerID && it.temporalColumnName) {
				// var src = prefix + ', [' + it.temporalColumnName + '] as start ' + bbox + ' from [' + it.layerID + '] WHERE ' + geoIntersects;
				var grp = 'CAST([' + it.temporalColumnName + '] as date) as start';
				var src = prefix + ', ' + grp + ' from [' + it.layerID + '] WHERE ' + geoIntersects;
				if (it.clouds) {
					src += ' AND [' + it.clouds.key + '] < ' + it.clouds.lt;
				}
				src += ' AND [' + it.temporalColumnName + '] BETWEEN ' + between;
				src += ' GROUP BY ' + grp;
				arr.push(fetch(src).then(function (response) { return response.json(); }));
				ids.push(it.layerID)
				/*
				(function() {
					var layerID = it.layerID;
					fetch(src)
						.then(function (response) { return response.json(); })
						.then(function (json) {
							if (json.Status === 'ok' && json.Result.values) {
								var selected = [],
									selectedItems = {};

								var data = json.Result.values.map(function (it, i) {
									var start = new Date(it[1] * 1000),
										tm = start.toUTCString();
									var item = {
										id: count,
										type: 'point',
										// title: it[0].toString(),
										// content: it[0].toString(),
										group: layerID,
										tm: tm,
										// bbox: [[it[4], it[2]], [it[5], it[3]]],
										start: start
									};
									if (_this._selectedItems[tm]) {
										selected.push(count);
										selectedItems[tm] = item;
									}
									count++;
									return item;
								});
								_this._items.add(data);
							}
						});
				})();*/
			}
		});
		
 // console.log('arr', arr)
		Promise.all(arr).then(function (results) {
			var count = 0,
				res = [];
				// jsonArr = [];
			results.map(function (json, nm) {
				// var json = promise.json();
					// promise.then(function (json) {
						if (json.Status === 'ok' && json.Result.values) {
 // console.log('json', json.Result.values.length)
							// var pLength = res.length,
								// nLength = json.Result.values.length + pLength,
							var layerID = ids[nm],
								selected = [],
								selectedItems = {};

							res.length += json.Result.values.length;
							json.Result.values.forEach(function (it, i) {
								var start = new Date(it[1] * 1000),
									tm = start.toUTCString();
								var item = {
									id: count,
									type: 'point',
									// title: it[0].toString(),
									// content: it[0].toString(),
									group: layerID,
									tm: tm,
									// bbox: [[it[4], it[2]], [it[5], it[3]]],
									start: start
								};
								if (_this._selectedItems[tm]) {
									selected.push(count);
									selectedItems[tm] = item;
								}
								res[count] = item;
								count++;
								return item;
							});
							// _this._items = new vis.DataSet(data);
							// _this._items.clear();
							// _this._items.add(data);
							// var dateInterval = _this._getDateInterval();
							// _this._timeline.setWindow(dateInterval[0], dateInterval[1]);
							// _this._timeline.setSelection(selected);
							// _this._selectedItems = selectedItems;

							// _this._reDraw();
							// var h = _this._leftSide.style.height;
							// _this._container.style.height = h + 'px';
						}
					// });
			});
			_this._items.clear();
			// _this._items = new vis.DataSet(data);
			_this._items.add(res);
			// var dateInterval = _this._getDateInterval();
			// _this._timeline.setWindow(dateInterval[0], dateInterval[1]);
			// _this._timeline.setSelection(selected);
			// _this._selectedItems = selectedItems;
 // console.log('results', results)
		});
    },

    _initTimeline: function () {
		var options = {
				stack: false,
				multiselect: true,
				zoomMin: 1000 * 60 * 60 * 24 * 30,
				// timeAxis: {scale: 'day'},
				// type: 'point',
				// showMajorLabels: false,
				// showMinorLabels: false,
				// format: {
					// minorLabels: {
						// day:        'D',
						// month:      'MMM',
						// year:       'YYYY'
					// },
					// majorLabels: {
						// day:        'D',
						// month:      'MMM',
						// year:       'YYYY'
					// }
				// },
				locales: {
					ru: {
						current: 'Текущее',
						time: 'время',
					}
				},
				locale: 'ru'
			};
		var groups = [];
		this.options.dataSources.forEach(function (it) {
			groups.push({
				id: it.layerID,
				title: it.title,
				content: it.content,
				layerID: it.layerID
			});
		});
		this._leftSide.innerHTML = '';

		if (this._timeline) {
			this._timeline.destroy();
		}
		var _this = this;
		this._selectedItems = {};
		this._items = new vis.DataSet([]);
        this._timeline = new vis.Timeline(this._leftSide, this._items, groups, options);
		this._timeline
			.on('click', function (items) {
				_this._selectedItems = {};
				var item = null;
				_this._items.get(_this._timeline.getSelection()).forEach(function (it, i) {
					item = it;
					var layerID = it.group,
						group = _this._selectedItems[layerID] || [];
					group.push(it);
					_this._selectedItems[layerID] = group;
				});
				
				_this.fire('click', {selected: _this._selectedItems, originalEvent: items.event});
			})
			.on('contextmenu', function (items, ev) {
				console.log('contextmenu', items, ev)
			});
    },

    _getDateInterval: function (flag) {
		var dateInterval = this.options.dateInterval || [this._defaults.zeroDate, this._defaults.zeroDate],
			d1 = dateInterval[0],
			d2 = dateInterval[1];
		return dateInterval.map(function (it) {
			// var date = Date(it.getFullYear(), it.getMonth(), it.getDay());
			return flag ? it.toISOString() : it;
		});
    },

    onAdd: function (map) {
		var container = this._container = L.DomUtil.create('div', this.options.className);
			leftSide = this._leftSide = L.DomUtil.create('div', 'leftSide gmx-hidden', container),
			rightSide = L.DomUtil.create('div', 'rightSide', container),
			icon = L.DomUtil.create('div', 'leaflet-gmx-iconSvg', rightSide),
			useHref = 'hide';

		icon.innerHTML = '<svg role="img" class="svgIcon">\
		  <use xlink:href="#' + useHref + '"></use>\
		</svg>';
        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(icon, 'mousemove', stop)
            .on(icon, 'touchstart', stop)
            .on(icon, 'mousedown', stop)
            .on(icon, 'dblclick', stop)
            .on(icon, 'click', stop)
            .on(icon, 'click', function () {
				var flag = L.DomUtil.hasClass(leftSide, 'gmx-hidden');
				L.DomUtil[flag ? 'removeClass' : 'addClass'](leftSide, 'gmx-hidden');
				this._sidebarOn = flag;
				if (this._sidebarOn) { this._bboxUpdate(); }
			}, this);

        container._id = this.options.id;
        this._map = map;
		this._initTimeline();

		L.DomEvent.disableScrollPropagation(container);
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        map.on('moveend', this._moveend, this);

        return container;
    }

});

L.control.gmxTimelineVisjs = function (options) {
  return new L.Control.GmxTimelineVisjs(options);
};
