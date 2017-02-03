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
		var state = {
			selectedItems: {},
			day: 1000*60*60*24,
			zeroDate: new Date(1980, 0, 1).getTime(),
			maxDate: new Date(2980, 0, 1).getTime()
		};
		this.options.dataSources.forEach(function (it) {
			if (it.layerID) {
				state[it.layerID] = it;
			}
		});
		this._state = state;
	},

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.off('moveend', this._moveend, this);
        map.fire('controlremove', this);
    },

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

		// this._items.clear();
		var count = 0;
		this.options.dataSources.forEach(function (it) {
			if (it.layerID && it.temporalColumnName) {
				var grp = 'CAST([' + it.temporalColumnName + '] as date) as start',
					src = prefix + ', ' + grp + ' from [' + it.layerID + '] WHERE ',
					whereArr = [
						geoIntersects,
						'[' + it.temporalColumnName + '] BETWEEN ' + between,
						
					];
				if (it.clouds) {
					whereArr.push('[' + it.clouds.key + '] < ' + it.clouds.lt);
				}
				if (it.isGeometryIdx === false) {
					whereArr.push(whereArr.shift());
				}
				src += whereArr.join(' AND ');
				src += ' GROUP BY ' + grp;
				arr.push(fetch(src).then(function (response) { return response.json(); }));
				ids.push(it.layerID)
			}
		});
		
		Promise.all(arr).then(function (results) {
			var count = 0,
				selected = [],
				res = [];
			results.map(function (json, nm) {
				if (json.Status === 'ok' && json.Result.values) {
					var layerID = ids[nm],
						selectedItems = _this._state.selectedItems[layerID] || {};

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
						if (selectedItems[tm]) {
							selected.push(count);
						}
						res[count] = item;
						count++;
						return item;
					});
				}
			});
			if (!_this._timeline) {
				_this._initTimeline(res);
			} else {
				_this._items.clear();
				_this._items.add(res);
			}
			_this._timeline.setSelection(selected);
		});
    },

    _initTimeline: function (data) {
		var options = {
				start: this.options.dateInterval[0],
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
		this._items = new vis.DataSet(data);
        this._timeline = new vis.Timeline(this._leftSide, this._items, groups, options);
		this._timeline
			.on('click', function (items) {
				var state = _this._state,
					out = {};
				state.selectedItems = {};
				_this._items.get(_this._timeline.getSelection()).forEach(function (it, i) {
					var layerID = it.group,
						group = out[layerID] || {filters: [], dateInterval: [state.maxDate, state.zeroDate]},
						d1 = it.start.getTime(),
						d2 = d1 + state.day,
						hash = state.selectedItems[layerID] || {};
						
					hash[it.tm] = true;
					state.selectedItems[layerID] = hash;
					group.filters.push([d1, d2]);
					group.dateInterval[0] = Math.min(d1, group.dateInterval[0]);
					group.dateInterval[1] = Math.max(d2, group.dateInterval[1]);
					out[layerID] = group;
				});
				_this.fire('click', {selected: out, originalEvent: items.event});
			})
			.on('contextmenu', function (items, ev) {
				console.log('contextmenu', items, ev)
			});
    },

    _getDateInterval: function (flag) {
		var dateInterval = this.options.dateInterval || [this._state.zeroDate, this._state.zeroDate],
			d1 = dateInterval[0],
			d2 = dateInterval[1];
		return dateInterval.map(function (it) {
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
