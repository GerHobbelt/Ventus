/**
 * Ventus
 * Copyright © 2012 Ramón Lamana
 * https://github.com/rlamana
 */
define([
	'ventus/core/emitter',
	'ventus/core/view',
	'tpl!ventus/tpl/window',
	'ventus/core/resizer',
	'ventus/wm/mover/moverLimiter',
	'less!ventus/css/window'
],
function(Emitter, View, WindowTemplate, Resizer, MoverLimiter) {
	'use strict';

	var Window = function (options, manager) {
		this.signals = new Emitter();
		this.manager = manager;

		options = options || {
			title: 'Untitle Window',
			width: 400,
			height: 200,
			x: 0,
			y: 0,
			content: '',

			movable: true,
			resizable: true,
			widget: false,
			titlebar: true,
			tiltAnimation: true,
			imageUrl: null,
			minimize: true,
			dontExecuteEventHandlers: false
		};
		var shouldRenderImage = false;
		if(options.imageUrl && options.imageUrl !== null) {
			shouldRenderImage=true;
		}

		if(options.tiltAnimation === null || options.tiltAnimation === undefined) {
			options.tiltAnimation = true;
		}

		if(options.minimize === null || options.minimize === undefined) {
			options.minimize = true;
		}

		// View
		this.el = View(WindowTemplate({
			title: options.title,
			imgUrl: options.imageUrl,
			minimize: options.minimize,
			renderImg: shouldRenderImage,
			classname: options.classname||''
		}));
		this.el.listen(this.events.window, this);

		if(options.opacity)
			this.el.css('opacity', options.opacity);

		if(options.minWidth)
			this.el.css('minWidth', options.minWidth);

		if(options.minHeight)
			this.el.css('minHeight', options.minHeight);

		// Cache content element
		this.$content = this.el.find('.wm-content');
		if(options.content)
			this.$content.append(options.content);

		// Cache header element
		this.$titlebar = this.el.find('header');

		this.width = options.width || 400;
		this.height = options.height || 200;

		this.x = options.x || 0;
		this.y = options.y || 0;
		this.z = 10000;

		// State
		this.opened = false;
		this.enabled = true;
		this.active = false;
		this.closed = false;
		this.maximized = options.maximized || false;
		this.minimized = false;

		this.shouldtiltOnMove = options.tiltAnimation;
		this.dontExecuteEventHandlers = options.dontExecuteEventHandlers; //if true, only emit events without execute it's handlers

		// Properties
		this.widget = false;
		this.movable = true;
		this.resizable = (typeof options.resizable !== 'undefined') ?
			options.resizable :
			true;
		this.disableContinuousResizeEvents = options.disableContinuousResizeEvents || false;

		this.titlebar = true;
	};

	Window.prototype = {
		_restore: null,
		_moving: null,
		_resizing: null,

		slots: {
			move: function(e) {
				if(!this.enabled || !this.movable) return;

				this._moving = this.toLocal({
					x: e.originalEvent.pageX,
					y: e.originalEvent.pageY
				});
				if(this.shouldtiltOnMove) {
					this.el.addClass('move');
				}
				e.preventDefault();
			}
		},

		doRenderOverlay: function() {
			this.el.prepend('<div class="resize-overlay"></div>');
		},

		doEraseOverlay: function() {
			$('.resize-overlay').remove();
		},

		addDivOverlay: function() {
			this.manager.addOverlaysToAllWindows();
		},
		removeDivOverlay: function() {
			this.manager.removeOverlaysToAllWindows();
		},

		events: {

			window: {
				'click': function(e) {
					this.signals.emit('select', this, e);
				},

				'mousedown': function(e) {
					this.focus();

					if(this.widget)
						this.slots.move.call(this, e);
				},

				'.wm-content click': function(e) {
					if(this.enabled)
						this.signals.emit('click', this, e);
				},

				'.wm-window-title mousedown': function(e) {
					this.addDivOverlay();
					this.slots.move.call(this, e);
				},

				'.wm-window-title dblclick': function() {
					if(this.enabled && this.resizable)
						this.maximize();
				},

				'.wm-window-title button.wm-close click': function(e) {
					e.stopPropagation();
					e.preventDefault();

					if(this.enabled){
						if (this.dontExecuteEventHandlers) {
							this.signals.emit('close', this);
						} else {
							this.close();
						}
					}
				},

				'.wm-window-title button.wm-maximize click': function(e) {
					e.stopPropagation();
					e.preventDefault();

					if(this.enabled && this.resizable)
						this.maximize();
				},

				'.wm-window-title button.wm-minimize click': function(e) {
					e.stopPropagation();
					e.preventDefault();

					if(this.enabled)
						this.minimize();
				},

				'.wm-window-title button mousedown': function(e) {
					this.focus();

					e.stopPropagation();
					e.preventDefault();
				},

				'button.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;
					this._resizing = {
						width: this.width - e.originalEvent.pageX,
						height: this.height - e.originalEvent.pageY
					};

					this.el.addClass('resizing');
					this.addDivOverlay();
					

					e.preventDefault();
				},

				'button.top-right.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

					this._resizing = {
						"top-right": true,
						width: this.width - e.originalEvent.pageX,
						height: this.height + e.originalEvent.pageY
					};

					this._moving = this.toLocal({
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY
					});
					this._moving['top-right'] = true;

					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				},

				'button.top-left.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

					this._resizing = {
						"top-left": true,
						width: this.width + e.originalEvent.pageX,
						height: this.height + e.originalEvent.pageY
					};

					this._moving = this.toLocal({
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY
					});
					this._moving['top-left'] = true;

					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				},

				'button.bottom-left.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

					this._resizing = {
						"bottom-left": true,
						width: this.width + e.originalEvent.pageX,
						height: this.height - e.originalEvent.pageY
					};

					this._moving = this.toLocal({
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY
					});
					this._moving['bottom-left'] = true;

					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				},

				'.wm-window-border.left.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

					this._resizing = {
						left: true,
						width: this.width + e.originalEvent.pageX,
						height: this.height
					};

					this._moving = this.toLocal({
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY
					});

					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				},
				'.wm-window-border.top.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

//					this._resizing = {
//						top: true,
//						width: this.width,
//						height: this.height + e.originalEvent.pageY
//					};
					this._resizer = new Resizer(this, e, 'top');

					this._moving = this.toLocal({
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY
					});

					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				},
				'.wm-window-border.bottom.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

					this._resizing = {
						bottom: true,
						width: this.width,
						height: this.height - e.originalEvent.pageY
					};
					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				},

				'.wm-window-border.right.wm-resize mousedown': function(e) {
					if(!this.enabled || !this.resizable) return;

					this._resizing = {
						right: true,
						width: this.width - e.originalEvent.pageX,
						height: this.height
					};
					this.el.addClass('resizing');
					this.addDivOverlay();

					e.preventDefault();
				}
			},

			space: {
				'mousemove': function(e) {
					if (this._moving) {
						if (this._moving['bottom-left']) {
							this.move(
								e.originalEvent.pageX - this._moving.x,
								this._resizing.y
							);
						} else if (this._moving['top-right']) {
							this.move(
								this._resizing.x,
								e.originalEvent.pageY - this._moving.y
							);
						} else if (this._moving['top-left']) {
							this.move(
								e.originalEvent.pageX - this._moving.x,
								e.originalEvent.pageY - this._moving.y
							);
						} else {
							this.move(
								e.originalEvent.pageX - this._moving.x,
								e.originalEvent.pageY - this._moving.y
							);
						}
					}

					if(this._resizing){
						if(this._resizing.left) {
							this.resize(
								this._resizing.width - e.originalEvent.pageX,
								this._resizing.height
							);
						}else if(this._resizing.bottom){
							this.resize(
								this._resizing.width,
								e.originalEvent.pageY + this._resizing.height
							);
						}else if(this._resizing.top){
							this.resize(
								this._resizing.width,
								this._resizing.height - e.originalEvent.pageY
							);
						}else if(this._resizing.right){
							this.resize(
								e.originalEvent.pageX + this._resizing.width,
								this._resizing.height
							);
						}else if(this._resizing["bottom-left"]){
							this.resize(
								this._resizing.width - e.originalEvent.pageX,
								e.originalEvent.pageY + this._resizing.height
							);
						}else if(this._resizing["top-right"]){
							this.resize(
								e.originalEvent.pageX + this._resizing.width,
								this._resizing.height - e.originalEvent.pageY
							);
						}else if(this._resizing["top-left"]){
							this.resize(
								this._resizing.width - e.originalEvent.pageX,
								this._resizing.height - e.originalEvent.pageY
							);
						}else{
							this.resize(
								e.originalEvent.pageX + this._resizing.width,
								e.originalEvent.pageY + this._resizing.height
							);
						}
					}
					if (this._resizer) {
						this._resizer.resize(e);
					}
				},

				'mouseup': function(e) {
					if (this._moving) {

						this.moverLimiter.checkOutOfBounds();

						if(this.shouldtiltOnMove) {
							this.el.removeClass('move');
						}

						this.signals.emit('move', this);
						this._moving = null;
					}

					if (this._resizing || this._resizer) {
						this.el.removeClass('resizing');
						this._restore = null;
						this._resizing = null;
						this._resizer = null;
						this.signals.emit('resize', this);
					}

					this.removeDivOverlay();
					e.stopPropagation();
				}
			}
		},

		set space(el) {
			if(el && !el.listen) {
				console.error('The given space element is not a valid View');
				return;
			}

			this._space = el;
			el.append(this.el);
			el.listen(this.events.space, this);
			this.moverLimiter = new MoverLimiter(this._space, this, this.$titlebar.height());
		},

		get space() {
			return this._space;
		},

		get maximized() {
			return this._maximized;
		},

		set maximized(value) {
			if(value) {
				this._restoreMaximized = this.stamp();
				this.signals.emit('maximize', this, this._restoreMaximized);
			}
			else {
				if(this.dontExecuteEventHandlers){
					this.signals.emit('restore', this);
				}else{
					this.signals.emit('restore', this, this._restoreMaximized);
				}
			}
			this._maximized = value;
		},


		get minimized() {
			return this._minimized;
		},

		set minimized(value) {
			if(value) {
				this._restoreMinimized = this.stamp();
				this.signals.emit('minimize', this, this._restoreMinimized);
			}
			else {
				this.signals.emit('restore', this, this._restoreMinimized);
			}

			this._minimized = value;
		},

		set active(value) {
			if(value) {
				if(!this._active){
					this.signals.emit('focus', this);
					this.el.addClass('active');
					this.el.removeClass('inactive');
				}
			}
			else {
				this.signals.emit('blur', this);
				this.el.removeClass('active');
				this.el.addClass('inactive');
			}

			this._active = value;
		},

		get active() {
			return this._active;
		},

		set enabled(value) {
			if(!value) {
				this.el.addClass('disabled');
			}
			else {
				this.el.removeClass('disabled');
			}

			this._enabled = value;
		},

		get enabled() {
			return this._enabled;
		},

		set movable(value) {
			this._movable = !!value;
		},

		get movable() {
			return this._movable;
		},

		set resizable(value) {
			if(!value) {
				this.el.addClass('noresizable');
			}
			else {
				this.el.removeClass('noresizable');
			}

			this._resizable = !!value;
		},

		get resizable() {
			return this._resizable;
		},

		set closed(value) {
			if(value) {
				if (!this.dontExecuteEventHandlers) {
					this.signals.emit('close', this);
				}


				this.el.addClass('closing');
				this.el.onAnimationEnd(function(){
					this.el.removeClass('closing');
					this.el.addClass('closed');
					this.el.hide();

					// Remove element
					this.$content.html('');
					this.signals.emit('closeDone', this);
				}, this);
			}

			this._closed = value;
		},

		get closed() {
			return this._closed;
		},

		set opened(value) {
			if(value) {
				this.signals.emit('open', this);

				// Open animation
				this.el.show();
				this.el.addClass('opening');
				this.el.onAnimationEnd(function(){
					this.el.removeClass('opening');
				}, this);
			}

			this._opened = value;
		},

		get opened() {
			return this._opened;
		},


		set widget(value) {
			this._widget = value;
		},

		get widget() {
			return this._widget;
		},

		set titlebar(value) {
			if(value)
				this.$titlebar.removeClass('hide');
			else
				this.$titlebar.addClass('hide');

			this._titlebar = value;
		},

		get titlebar() {
			return this._titlebar;
		},

		set width(value) {
			this.el.width(value);
		},

		get width() {
			return parseInt(this.el.width(), 10);
		},

		set height(value) {
			// This shouldn't be done if flexible box model
			// worked properly with overflow-y: auto
			//this.$content.height(value - this.$header.outerHeight());

			this.el.height(value);
		},

		get height() {
			return parseInt(this.el.height(), 10);
		},

		set x(value) {
			this.el.css('left', value);
		},

		set y(value) {
			this.el.css('top', value);
		},

		get x() {
			return parseInt(this.el.css('left'), 10);
		},

		get y() {
			return parseInt(this.el.css('top'), 10);
		},

		set z(value) {
			this.el.css('z-index', value);
		},

		get z() {
			return parseInt(this.el.css('z-index'), 10);
		},

		set id(value) {
			this._id = value;
		},

		get id() {
			return this._id;
		},

		open: function() {
			this.opened = true;
			return this;
		},

		resize: function(w, h) {
			this.width = w;
			this.height = h;
			if (!this.disableContinuousResizeEvents) {
				this.signals.emit('resize', this);
			}
			return this;
		},

		move: function(x, y) {
			this.x = x;
			this.y = y;
			return this;
		},

		/**
		 * @return A function that restores this window
		 */
		stamp: function() {
			this.restore = (function() {
				var size = {
					width: this.width,
					height: this.height
				};

				var pos = {
					x: this.x,
					y: this.y
				};

				return function() {
					this.resize(size.width, size.height);
					this.move(pos.x, pos.y);

					return this;
				};
			}).apply(this);

			return this.restore;
		},

		restore: function(){
			this.resize(this.width, this.height);
		},

		maximize: function(maximized) {
			this.el.addClass('maximazing');
			this.el.onTransitionEnd(function(){
				this.el.removeClass('maximazing');
				this.resize(this.width, this.height);
			}, this);

			this.maximized = maximized !== undefined && maximized !== null? maximized : !this.maximized;
			return this;
		},

		minimize: function() {
			this.el.addClass('minimizing');
			this.el.onTransitionEnd(function(){
				this.el.removeClass('minimizing');
				this.resize(this.width, this.height);
			}, this);

			this.minimized = !this.minimized;
			return this;
		},

		close: function() {
			this.closed = true;
			return this;
		},

		focus: function() {
			this.active = true;
			return this;
		},

		blur: function() {
			this.active = false;
			return this;
		},

		toLocal: function(coord) {
			return {
				x: coord.x - this.x,
				y: coord.y - this.y
			};
		},

		toGlobal: function(coord) {
			return {
				x: coord.x + this.x,
				y: coord.y + this.y
			};
		},

		append: function(el) {
			el.appendTo(this.$content);
		}
	};

	return Window;
});
