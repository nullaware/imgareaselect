/*
 * imgAreaSelect jQuery plugin
 * version 0.9.9
 *
 * Copyright (c) 2008-2011 Michal Wojciechowski (odyniec.net)
 *
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * http://odyniec.net/projects/imgareaselect/
 *
 */

(function($) {

/*
 * Math functions will be used extensively, so it's convenient to make a few
 * shortcuts
 */    
var abs = Math.abs,
    max = Math.max,
    min = Math.min,
    round = Math.round;

/**
 * Create a new HTML div element
 * 
 * @return A jQuery object representing the new element
 */
function div() {
    return $('<div/>');
}

/**
 * imgAreaSelect initialization
 * 
 * @param img
 *            A HTML image element to attach the plugin to
 * @param options
 *            An options object
 */
$.imgAreaSelect = function (img, options) {
    var 
        /* jQuery object representing the image */ 
        $img = $(img),
        
        /* Has the image finished loading? */
        imgLoaded,
        
        /* Unique id for multi select box class */
        id = (new Date).getTime(),

        /* Default options object used on initialization */
        defaultOptions,
        
        /* Plugin elements */
        
        /* jQuery collection of all $box elements */
        $boxes,
        /* Container box */
        $box,
        /* Image Selection */
        $imgSelect,
        /* Selection area */
        $area,
        /* Border (four divs) */
        $border,
        /* Overlay area */
        $overlay = div(),
        /* Handles (empty by default, initialized in setOptions()) */
        $handles,
        
        /*
         * Additional element to work around a cursor problem in Opera
         * (explained later)
         */
        $areaOpera,
        
        /* Image position (relative to viewport) */
        left, top,
        
        /* Image offset (as returned by .offset()) */
        imgOfs = { left: 0, top: 0 },
        
        /* Image dimensions (as returned by .width() and .height()) */
        imgWidth, imgHeight,
        
        /*
         * jQuery object representing the parent element that the plugin
         * elements are appended to
         */
        $parent,
        
        /* Parent element offset (as returned by .offset()) */
        parOfs = { left: 0, top: 0 },
        
        /* Base z-index for plugin elements */
        zIndex = 0,
                
        /* Plugin elements position */
        position = 'absolute',
        
        /* X/Y coordinates of the starting point for move/resize operations */ 
        startX, startY,
        
        /* Horizontal and vertical scaling factors */
        scaleX, scaleY,
        
        /* Current resize mode ("nw", "se", etc.) */
        resize,
        
        /* Selection area constraints */
        minWidth, minHeight, maxWidth, maxHeight,
        
        /* Aspect ratio to maintain (floating point number) */
        aspectRatio,
        
        /* Are the plugin elements currently displayed? */
        shown,
        
        /* Current selection (relative to parent element) */
        x1, y1, x2, y2,
        
        /* Current selection (relative to scaled image) */
        selection,
        
        /* Document element */
        docElem = document.documentElement,
        
        /* Various helper variables used throughout the code */ 
        $p, d, i, o, w, h, adjusted;


    /*
     * Multi Select specific functions
     */
    
    /**
     * Initialise globals for new selection area
     */
    function initSelection() {
        var imgSelect_css = {
            border: 'none',
            margin: 0,
            padding: 0,
            position: 'absolute',
            opacity: options.activeOpacity||1
        };
        
        /* Generate clone of img to be used as selection area image */
        $imgSelect = $('<img />').attr('src', $img.attr('src'))
            .css(imgSelect_css).width($img.width()).height($img.height());

        /* Initialise all other selection variables */
        $box = div();
        $area = div();
        $border = div().add(div()).add(div()).add(div());
        $handles = $([]);
        resize = '';
        x1 = y1 = x2 = y2 = 0;
        selection = { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 };

        /*
        * We initially set visibility to "hidden" as a workaround for a weird
        * behaviour observed in Google Chrome 1.0.154.53 (on Windows XP). Normally
        * we would just set display to "none", but, for some reason, if we do so
        * then Chrome refuses to later display the element with .show() or
        * .fadeIn().
        */
        $box.css({ visibility: 'hidden', position: position,
            overflow: 'hidden', zIndex: zIndex || '0' });
        $overlay.css({ position: position,
            overflow: 'hidden', zIndex: zIndex || '0' });
        $box.css({ zIndex: zIndex + 3 || 3 });
        $area.add($border).css({ position: 'absolute', fontSize: 0 });
        
        /* Set flag to indicate active area */
        $box.data('selection', {active: true});
    }

    /**
     * Add new Selection area
     *
     * @param opts
     *            options object for new area
     */
    function addSelection(opts) {
        var activeSelection = false,
            /* generate options object from options on plugin initialisation */
            baseOpts = $.extend({show: true, enable: true}, defaultOptions);

        /* Check if the current area is visible */
        if(selection.width * selection.height) {
            activeSelection = true;
            
            /* Save current area and deactivate */
            saveSelection();
            setSelectionState(false);
            
            /* Re-initialise selection variables */
            initSelection();
        } else {
            /* Ensure new selection is enabled */
            setSelectionState(true);
        }
        
        /* combine passed options with base options & set */
        opts = opts ? $.extend(baseOpts, opts) : baseOpts;
        setOptions(opts);

        /* Remove passed selection area co-ordinates */
        with(options) {
            delete x1; delete y1; delete x2; delete y2;
        }
        
        /* Save new selection area */
        saveSelection();

        /* Chrome display bug workaround */
        $box.add($overlay).css({ visibility: '' });

        /* Callback if new area has been added and not an API call */
        if(activeSelection && !(this instanceof $.imgAreaSelect)) {
            options.onSelectAdd(img, $boxes.index($box), getSelection());
        } else {
            /* Return new selection on API call only */
            return $box;
        }
    }

    /**
     * Set active state of current selection area
     *
     * @param active
     *            boolean state indicator
     */
    function setSelectionState(state) {
        if(!$box || $box.data('selection').active === state) return;
        
        if(state) {
            /*
             * Activate selection area
             */
            $box.css('cursor', options.movable ? 'move' : 'pointer')
                .addClass('active')
                .data('selection').active = true;

            $imgSelect.css('opacity', options.activeOpacity||1);
        } else {
            /* 
             * Deactivate selection area
             * Remove mousemove event leaving mousedown to detect area changes 
             */ 
            $box.unbind('mousemove', areaMouseMove)
                .css('cursor', 'pointer')
                .removeClass('active')
                .data('selection').active = false;
             
            $imgSelect.css('opacity', options.inactiveOpacity||0.5);
            
            /* Detach handles from inactive selection */
            $handles.detach();
        }
    }
    
    /**
     * Save active selection
     *
     */
    function saveSelection() {
        
        /* Get current active state */
        var active = $box.data('selection').active;

        if($box) {
            /* Store area specific values & options on box element */
            $box.data('selection' ,{
                box: $box,
                area: $area,
                border: $border,
                handles: $handles,
                areaOpera: $areaOpera,
                imgSelect: $imgSelect,
                x1: x1, y1: y1, x2: x2, y2: y2,
                selection: selection,
                options: $.extend({}, options),
                active: active
            });
        }
    }

    /**
     * Process selection change 
     * 
     * @param newSelection
     *            object of new selection area values & options
     */
    function swapSelection(newSelection) {

        /* Get index of current selection */
        var previous = $boxes.index($box);

        /* Save & deactivate current selection when it is in use */
        if(selection.width * selection.height) {
            saveSelection();
            setSelectionState(false);
        } else {
            /* Remove unused selection area */
            $box.remove();
        }

        /* Reset globals with new selection data */
        $box = newSelection.box;
        $area = newSelection.area;
        $border = newSelection.border;
        $handles = newSelection.handles;
        $areaOpera = newSelection.areaOpera;
        $imgSelect = newSelection.imgSelect;
        x1 = newSelection.x1; y1 = newSelection.y1;
        x2 = newSelection.x2; y2 = newSelection.y2;
        selection = newSelection.selection;
        resize = '';

        /* Reset plugin options with new selection area values */
        setOptions($.extend({enable:true}, newSelection.options));

        /* Update state of newly selected area */
        setSelectionState(true);
        
        doUpdate();

        /* If not an API call fire callback with previous & new area indexes  */
        if(!(this instanceof $.imgAreaSelect))
            options.onSelectSwap(img, $boxes.index($box), previous);
    }
    
    /**
     * Check for any visible selection areas
     * 
     * @return boolean
     */
    function visibleSelections() {
        var visible = false;
        $('div.' + options.classPrefix + '-box-'+id).each(function() {
            var selection = $(this).data('selection').selection;
            if(selection.width * selection.height) {
                /* Visible selection found. Set flag and terminate */
                visible = true;
                return false;
            }
        });
        return visible;
    }
    
    /**
     * Remove selection
     * 
     * @param index
     *            0-based position of selection to remove
     * @return boolean success
     */
    function removeSelection(index) {
        var current = $boxes.index($box);

        /* Set to current selection if index not passed */
        index = index == null ? current : parseInt(index);

        if($boxes.length > 1) {

            /* Remove element when there are more than 1 selections */
            if(current == index) 
                /* Swap to another selection if removing current */
                swapSelection($boxes.eq(index?index-1:1).data('selection'));

            /* Remove the selection element */
            $boxes.eq(index).remove();
            
            /* Update the boxes collection */
            $boxes = $('div.' + options.classPrefix + '-box-'+id);

            if(!(this instanceof $.imgAreaSelect))
                options.onSelectRemove(img, index);

        } else {

            if(current == index) {
                /* Hide instead or removing single selection */
                hide($box);
                $box.unbind('mousemove', areaMouseMove)
                    .unbind('mousedown', areaMouseDown);
                setSelection(0, 0, 0, 0);
                
                /* Remove overlay when there are no more visible selections */
                if(!visibleSelections()) hide($overlay);
            }
        }
    }


    /*
     * Translate selection coordinates (relative to scaled image) to viewport
     * coordinates (relative to parent element)
     */
    
    /**
     * Translate selection X to viewport X
     * 
     * @param x
     *            Selection X
     * @return Viewport X
     */
    function viewX(x) {
        return x + imgOfs.left - parOfs.left;
    }

    /**
     * Translate selection Y to viewport Y
     * 
     * @param y
     *            Selection Y
     * @return Viewport Y
     */
    function viewY(y) {
        return y + imgOfs.top - parOfs.top;
    }

    /*
     * Translate viewport coordinates to selection coordinates
     */
    
    /**
     * Translate viewport X to selection X
     * 
     * @param x
     *            Viewport X
     * @return Selection X
     */
    function selX(x) {
        return x - imgOfs.left + parOfs.left;
    }

    /**
     * Translate viewport Y to selection Y
     * 
     * @param y
     *            Viewport Y
     * @return Selection Y
     */
    function selY(y) {
        return y - imgOfs.top + parOfs.top;
    }
    
    /*
     * Translate event coordinates (relative to document) to viewport
     * coordinates
     */
    
    /**
     * Get event X and translate it to viewport X
     * 
     * @param event
     *            The event object
     * @return Viewport X
     */
    function evX(event) {
        return event.pageX - parOfs.left;
    }

    /**
     * Get event Y and translate it to viewport Y
     * 
     * @param event
     *            The event object
     * @return Viewport Y
     */
    function evY(event) {
        return event.pageY - parOfs.top;
    }

    /**
     * Get the current selection
     * 
     * @param noScale
     *            If set to <code>true</code>, scaling is not applied to the
     *            returned selection
     * @return Selection object
     */
    function getSelection(noScale) {
        var sx = noScale || scaleX, sy = noScale || scaleY;
        /* Added zIndex to Selection object */
        return { x1: round(selection.x1 * sx),
            y1: round(selection.y1 * sy),
            x2: round(selection.x2 * sx),
            y2: round(selection.y2 * sy),
            width: round(selection.x2 * sx) - round(selection.x1 * sx),
            height: round(selection.y2 * sy) - round(selection.y1 * sy),
            zindex: parseInt($box.css('z-index'))-2 };
    }
    
    /**
     * Set the current selection
     * 
     * @param x1
     *            X coordinate of the upper left corner of the selection area
     * @param y1
     *            Y coordinate of the upper left corner of the selection area
     * @param x2
     *            X coordinate of the lower right corner of the selection area
     * @param y2
     *            Y coordinate of the lower right corner of the selection area
     * @param noScale
     *            If set to <code>true</code>, scaling is not applied to the
     *            new selection
     */
    function setSelection(x1, y1, x2, y2, noScale) {
        var sx = noScale || scaleX, sy = noScale || scaleY;
        
        selection = {
            x1: round(x1 / sx || 0),
            y1: round(y1 / sy || 0),
            x2: round(x2 / sx || 0),
            y2: round(y2 / sy || 0)
        };
        
        selection.width = selection.x2 - selection.x1;
        selection.height = selection.y2 - selection.y1;
        saveSelection();
    }

    /**
     * Recalculate image and parent offsets
     */
    function adjust() {
        /*
         * Do not adjust if image width is not a positive number. This might
         * happen when imgAreaSelect is put on a parent element which is then
         * hidden.
         */
        if (!$img.width())
            return;
        
        /*
         * Get image offset. The .offset() method returns float values, so they
         * need to be rounded.
         */
        imgOfs = { left: round($img.offset().left), top: round($img.offset().top) };
        
        /* Get image dimensions */
        imgWidth = $img.innerWidth();
        imgHeight = $img.innerHeight();
        
        imgOfs.top += ($img.outerHeight() - imgHeight) >> 1;
        imgOfs.left += ($img.outerWidth() - imgWidth) >> 1;

        /* Set minimum and maximum selection area dimensions */
        minWidth = round(options.minWidth / scaleX) || 0;
        minHeight = round(options.minHeight / scaleY) || 0;
        maxWidth = round(min(options.maxWidth / scaleX || 1<<24, imgWidth));
        maxHeight = round(min(options.maxHeight / scaleY || 1<<24, imgHeight));
        
        /*
         * Workaround for jQuery 1.3.2 incorrect offset calculation, originally
         * observed in Safari 3. Firefox 2 is also affected.
         */
        if ($().jquery == '1.3.2' && position == 'fixed' &&
            !docElem['getBoundingClientRect'])
        {
            imgOfs.top += max(document.body.scrollTop, docElem.scrollTop);
            imgOfs.left += max(document.body.scrollLeft, docElem.scrollLeft);
        }

        /* Determine parent element offset */ 
        parOfs = /absolute|relative/.test($parent.css('position')) ?
            { left: round($parent.offset().left) - $parent.scrollLeft(),
                top: round($parent.offset().top) - $parent.scrollTop() } :
            position == 'fixed' ?
                { left: $(document).scrollLeft(), top: $(document).scrollTop() } :
                { left: 0, top: 0 };
                
        left = viewX(0);
        top = viewY(0);
        
        /*
         * Check if selection area is within image boundaries, adjust if
         * necessary
         */
        if (selection.x2 > imgWidth || selection.y2 > imgHeight)
            doResize();
    }

    /**
     * Update plugin elements
     * 
     * @param resetKeyPress
     *            If set to <code>false</code>, this instance's keypress
     *            event handler is not activated
     */
    function update(resetKeyPress) {
        /* If plugin elements are hidden, do nothing */
        if (!shown) return;

        /*
         * Set position and size of each container box and selection area
         * inside it
         */
        $boxes.each(function(index) {
            var s = $(this).data('selection');
            s.box.css({ left: viewX(s.selection.x1), top: viewY(s.selection.y1) })
                .add(s.area)
                .width(w = s.selection.width).height(h = s.selection.height);
        });

        /*
         * Reset the position of selection area, borders, and handles (IE6/IE7
         * position them incorrectly if we don't do this)
         */ 
        $area.add($border).add($handles).css({ left: 0, top: 0 });

        /* Set border dimensions */
        $border
            .width(max(w - $border.outerWidth() + $border.innerWidth(), 0))
            .height(max(h - $border.outerHeight() + $border.innerHeight(), 0));

        /* Position the overlay element */
        $overlay.css({ left: left, top: top,
            width: imgWidth, height: imgHeight });
        w -= $handles.outerWidth();
        h -= $handles.outerHeight();
        
        /* Position Selection Image */
        $imgSelect.css({left: '-'+selection.x1+'px',top:'-'+selection.y1+'px'});
        
        /* Arrange handles */
        switch ($handles.length) {
        case 8:
            $($handles[4]).css({ left: w >> 1 });
            $($handles[5]).css({ left: w, top: h >> 1 });
            $($handles[6]).css({ left: w >> 1, top: h });
            $($handles[7]).css({ top: h >> 1 });
        case 4:
            $handles.slice(1,3).css({ left: w });
            $handles.slice(2,4).css({ top: h });
        }

        if (resetKeyPress !== false) {
            /*
             * Need to reset the document keypress event handler -- unbind the
             * current handler
             */
            if ($.imgAreaSelect.keyPress != docKeyPress)
                $(document).unbind($.imgAreaSelect.keyPress,
                    $.imgAreaSelect.onKeyPress);

            if (options.keys)
                /*
                 * Set the document keypress event handler to this instance's
                 * docKeyPress() function
                 */
                $(document)[$.imgAreaSelect.keyPress](
                    $.imgAreaSelect.onKeyPress = docKeyPress);
        }

        /*
         * Internet Explorer displays 1px-wide dashed borders incorrectly by
         * filling the spaces between dashes with white. Toggling the margin
         * property between 0 and "auto" fixes this in IE6 and IE7 (IE8 is still
         * broken). This workaround is not perfect, as it requires setTimeout()
         * and thus causes the border to flicker a bit, but I haven't found a
         * better solution.
         * 
         * Note: This only happens with CSS borders, set with the borderWidth,
         * borderOpacity, borderColor1, and borderColor2 options (which are now
         * deprecated). Borders created with GIF background images are fine.
         */ 
        if ($.browser.msie && $border.outerWidth() - $border.innerWidth() == 2) {
            $border.css('margin', 0);
            setTimeout(function () { $border.css('margin', 'auto'); }, 0);
        }
    }
    
    /**
     * Do the complete update sequence: recalculate offsets, update the
     * elements, and set the correct values of x1, y1, x2, and y2.
     * 
     * @param resetKeyPress
     *            If set to <code>false</code>, this instance's keypress
     *            event handler is not activated
     */
    function doUpdate(resetKeyPress) {
        adjust();
        update(resetKeyPress);
        x1 = viewX(selection.x1); y1 = viewY(selection.y1);
        x2 = viewX(selection.x2); y2 = viewY(selection.y2);
    }
    
    /**
     * Hide or fade out an element (or multiple elements)
     * 
     * @param $elem
     *            A jQuery object containing the element(s) to hide/fade out
     * @param fn
     *            Callback function to be called when fadeOut() completes
     */
    function hide($elem, fn) {
        options.fadeSpeed ? $elem.fadeOut(options.fadeSpeed, fn) : $elem.hide(); 
    }

    /**
     * Selection area mousemove event handler
     * 
     * @param event
     *            The event object
     */
    function areaMouseMove(event) {
        var x = selX(evX(event)) - selection.x1,
            y = selY(evY(event)) - selection.y1;
        
        if (!adjusted) {
            adjust();
            adjusted = true;

            $box.one('mouseout', function () { adjusted = false; });
        }

        /* Clear the resize mode */
        resize = '';

        if (options.resizable) {
            /*
             * Check if the mouse pointer is over the resize margin area and set
             * the resize mode accordingly
             */
            if (y <= options.resizeMargin)
                resize = 'n';
            else if (y >= selection.height - options.resizeMargin)
                resize = 's';
            if (x <= options.resizeMargin)
                resize += 'w';
            else if (x >= selection.width - options.resizeMargin)
                resize += 'e';
        }

        $box.css('cursor', resize ? resize + '-resize' :
            options.movable ? 'move' : '');
        if ($areaOpera)
            $areaOpera.toggle();
    }

    /**
     * Document mouseup event handler
     * 
     * @param event
     *            The event object
     */
    function docMouseUp(event) {
        /* Set back the default cursor */
        $('body').css('cursor', '');

        saveSelection();
        /*
         * If autoHide is enabled, or there are no visible selections,
         * hide the selection and the overlay area
         */
        if (options.autoHide || !visibleSelections())
            hide($box.add($overlay), function () { $(this).hide(); });

        $(document).unbind('mousemove', selectingMouseMove);
        $box.mousemove(areaMouseMove);
        
        options.onSelectEnd(img, $boxes.index($box), getSelection());
    }

    /**
     * Selection area mousedown event handler
     * 
     * @param event
     *            The event object
     * @return false
     */
    function areaMouseDown(event) {
        if (event.which != 1) return false;
        
        /* Switch selection areas if the this is not active */
        if(!$(this).data('selection').active)
            swapSelection($(this).data('selection'));

        adjust();

        if (resize) {
            /* Resize mode is in effect */
            $('body').css('cursor', resize + '-resize');

            x1 = viewX(selection[/w/.test(resize) ? 'x2' : 'x1']);
            y1 = viewY(selection[/n/.test(resize) ? 'y2' : 'y1']);
            
            $(document).mousemove(selectingMouseMove)
                .one('mouseup', docMouseUp);
            $box.unbind('mousemove', areaMouseMove);
        }
        else if (options.movable) {
            startX = left + selection.x1 - evX(event);
            startY = top + selection.y1 - evY(event);

            $box.unbind('mousemove', areaMouseMove);

            $(document).mousemove(movingMouseMove)
                .one('mouseup', function () {
                    options.onSelectEnd(img, $boxes.index($box), getSelection());

                    $(document).unbind('mousemove', movingMouseMove);
                    $box.mousemove(areaMouseMove);
                });
        }
        else
            if(!options.autoAdd) $img.mousedown(event);

        return false;
    }

    /**
     * Adjust the x2/y2 coordinates to maintain aspect ratio (if defined)
     * 
     * @param xFirst
     *            If set to <code>true</code>, calculate x2 first. Otherwise,
     *            calculate y2 first.
     */
    function fixAspectRatio(xFirst) {
        if (aspectRatio)
            if (xFirst) {
                x2 = max(left, min(left + imgWidth,
                    x1 + abs(y2 - y1) * aspectRatio * (x2 > x1 || -1)));    
                y2 = round(max(top, min(top + imgHeight,
                    y1 + abs(x2 - x1) / aspectRatio * (y2 > y1 || -1))));
                x2 = round(x2);
            }
            else {
                y2 = max(top, min(top + imgHeight,
                    y1 + abs(x2 - x1) / aspectRatio * (y2 > y1 || -1)));
                x2 = round(max(left, min(left + imgWidth,
                    x1 + abs(y2 - y1) * aspectRatio * (x2 > x1 || -1))));
                y2 = round(y2);
            }
    }

    /**
     * Resize the selection area respecting the minimum/maximum dimensions and
     * aspect ratio
     */
    function doResize() {
        /*
         * Make sure the top left corner of the selection area stays within
         * image boundaries (it might not if the image source was dynamically
         * changed).
         */
        x1 = min(x1, left + imgWidth);
        y1 = min(y1, top + imgHeight);
        
        if (abs(x2 - x1) < minWidth) {
            /* Selection width is smaller than minWidth */
            x2 = x1 - minWidth * (x2 < x1 || -1);

            if (x2 < left)
                x1 = left + minWidth;
            else if (x2 > left + imgWidth)
                x1 = left + imgWidth - minWidth;
        }

        if (abs(y2 - y1) < minHeight) {
            /* Selection height is smaller than minHeight */
            y2 = y1 - minHeight * (y2 < y1 || -1);

            if (y2 < top)
                y1 = top + minHeight;
            else if (y2 > top + imgHeight)
                y1 = top + imgHeight - minHeight;
        }

        x2 = max(left, min(x2, left + imgWidth));
        y2 = max(top, min(y2, top + imgHeight));
        
        fixAspectRatio(abs(x2 - x1) < abs(y2 - y1) * aspectRatio);

        if (abs(x2 - x1) > maxWidth) {
            /* Selection width is greater than maxWidth */
            x2 = x1 - maxWidth * (x2 < x1 || -1);
            fixAspectRatio();
        }

        if (abs(y2 - y1) > maxHeight) {
            /* Selection height is greater than maxHeight */
            y2 = y1 - maxHeight * (y2 < y1 || -1);
            fixAspectRatio(true);
        }

        selection = { x1: selX(min(x1, x2)), x2: selX(max(x1, x2)),
            y1: selY(min(y1, y2)), y2: selY(max(y1, y2)),
            width: abs(x2 - x1), height: abs(y2 - y1) };

        update();

        options.onSelectChange(img, $boxes.index($box), getSelection());
    }

    /**
     * Mousemove event handler triggered when the user is selecting an area
     * 
     * @param event
     *            The event object
     * @return false
     */
    function selectingMouseMove(event) {
        x2 = /w|e|^$/.test(resize) || aspectRatio ? evX(event) : viewX(selection.x2);
        y2 = /n|s|^$/.test(resize) || aspectRatio ? evY(event) : viewY(selection.y2);

        doResize();

        return false;        
    }

    /**
     * Move the selection area
     * 
     * @param newX1
     *            New viewport X1
     * @param newY1
     *            New viewport Y1
     */
    function doMove(newX1, newY1) {
        x2 = (x1 = newX1) + selection.width;
        y2 = (y1 = newY1) + selection.height;

        $.extend(selection, { x1: selX(x1), y1: selY(y1), x2: selX(x2),
            y2: selY(y2) });

        update();

        options.onSelectChange(img, $boxes.index($box), getSelection());
    }

    /**
     * Mousemove event handler triggered when the selection area is being moved
     * 
     * @param event
     *            The event object
     * @return false
     */
    function movingMouseMove(event) {
        x1 = max(left, min(startX + evX(event), left + imgWidth - selection.width));
        y1 = max(top, min(startY + evY(event), top + imgHeight - selection.height));

        doMove(x1, y1);

        event.preventDefault();     
        return false;
    }

    /**
     * Start selection
     */
    function startSelection() {
        $(document).unbind('mousemove', startSelection);
        adjust();

        x2 = x1;
        y2 = y1;       
        doResize();

        resize = '';

        if (!$box.is(':visible'))
            /* Show the plugin elements */
            $box.add($overlay).hide().fadeIn(options.fadeSpeed||0);

        shown = true;

        $(document).unbind('mouseup', cancelSelection)
            .mousemove(selectingMouseMove).one('mouseup', docMouseUp);
        $box.unbind('mousemove', areaMouseMove);

        options.onSelectStart(img, getSelection());
    }

    /**
     * Cancel selection
     */
    function cancelSelection() {
        $(document).unbind('mousemove', startSelection)
            .unbind('mouseup', cancelSelection);
        hide($box);
        
        setSelection(selX(x1), selY(y1), selX(x1), selY(y1));

        if(!visibleSelections()) hide($overlay);
        
        /* If this is an API call, callback functions should not be triggered */
        if (!(this instanceof $.imgAreaSelect)) {
            options.onSelectChange(img, $boxes.index($box), getSelection());
            options.onSelectEnd(img, $boxes.index($box), getSelection());
        }
    }

    /**
     * Image mousedown event handler
     * 
     * @param event
     *            The event object
     * @return false
     */
    function imgMouseDown(event) {
        /* Ignore the event if animation is in progress */
        if (event.which != 1 || $overlay.is(':animated')) return false;

        if(options.autoAdd)
            addSelection();

        adjust();
        startX = x1 = evX(event);
        startY = y1 = evY(event);

        /* Selection will start when the mouse is moved */
        $(document).mousemove(startSelection).mouseup(cancelSelection);

        return false;
    }
    
    /**
     * Window resize event handler
     */
    function windowResize() {
        doUpdate(false);
    }

    /**
     * Image load event handler. This is the final part of the initialization
     * process.
     */
    function imgLoad() {
        imgLoaded = true;

        /* Initialise Selection variables */
        initSelection();

        /* Set options */
        setOptions(options = $.extend({
            classPrefix: 'imgareaselect',
            movable: true,
            parent: 'body',
            resizable: true,
            resizeMargin: 10,
            aspectRatio: '',
            maxHeight: 0,
            maxWidth: 0,
            minHeight: 0,
            minWidth: 0,
            onInit: function () {},
            onSelectStart: function () {},
            onSelectChange: function () {},
            onSelectEnd: function () {},
            onSelectSwap: function() {},
            onSelectAdd: function() {},
            onSelectRemove: function() {}
        }, options));

        /* Take a copy of initialisation options */
        defaultOptions = $.extend({}, options);

        /* Remove callbacks and positioning data */
        for(var option in defaultOptions) {
            if(/^x\d$|^y\d$|^onSelect.*$|^onInit$/.test(option))
                delete defaultOptions[option];
        }

        $box.add($overlay).css({ visibility: '' });
        
        if (options.show) {
            shown = true;
            adjust();
            update();
            $box.add($overlay).hide().fadeIn(options.fadeSpeed||0);
        }

        /*
         * Call the onInit callback. The setTimeout() call is used to ensure
         * that the plugin has been fully initialized and the object instance is
         * available (so that it can be obtained in the callback).
         */
        setTimeout(function () { options.onInit(img, getSelection()); }, 0);
    }

    /**
     * Document keypress event handler
     * 
     * @param event
     *            The event object
     * @return false
     */
    var docKeyPress = function(event) {
        var k = options.keys, d, t, key = event.keyCode;
        
        d = !isNaN(k.alt) && (event.altKey || event.originalEvent.altKey) ? k.alt :
            !isNaN(k.ctrl) && event.ctrlKey ? k.ctrl :
            !isNaN(k.shift) && event.shiftKey ? k.shift :
            !isNaN(k.arrows) ? k.arrows : 10;

        /* Removes current selection using delete key when enabled */
        if(key == 46 && options.keyDelete) {
            removeSelection();
            return false;
        }
        
        if (k.arrows == 'resize' || (k.shift == 'resize' && event.shiftKey) ||
            (k.ctrl == 'resize' && event.ctrlKey) ||
            (k.alt == 'resize' && (event.altKey || event.originalEvent.altKey)))
        {
            /* Resize selection */
            
            switch (key) {
            case 37:
                /* Left */
                d = -d;
            case 39:
                /* Right */
                t = max(x1, x2);
                x1 = min(x1, x2);
                x2 = max(t + d, x1);
                fixAspectRatio();
                break;
            case 38:
                /* Up */
                d = -d;
            case 40:
                /* Down */
                t = max(y1, y2);
                y1 = min(y1, y2);
                y2 = max(t + d, y1);
                fixAspectRatio(true);
                break;
            default:
                return;
            }

            doResize();
        }
        else {
            /* Move selection */
            
            x1 = min(x1, x2);
            y1 = min(y1, y2);

            switch (key) {
            case 37:
                /* Left */
                doMove(max(x1 - d, left), y1);
                break;
            case 38:
                /* Up */
                doMove(x1, max(y1 - d, top));
                break;
            case 39:
                /* Right */
                doMove(x1 + min(d, imgWidth - selX(x2)), y1);
                break;
            case 40:
                /* Down */
                doMove(x1, y1 + min(d, imgHeight - selY(y2)));
                break;
            default:
                return;
            }
        }

        return false;
    };

    /**
     * Apply style options to plugin element (or multiple elements)
     * 
     * @param $elem
     *            A jQuery object representing the element(s) to style
     * @param props
     *            An object that maps option names to corresponding CSS
     *            properties
     */
    function styleOptions($elem, props) {
        for (var option in props)
            if (options[option] !== undefined)
                $elem.css(props[option], options[option]);
    }

    /**
     * Set plugin options
     * 
     * @param newOptions
     *            The new options object
     */
    function setOptions(newOptions) {
        var boxVisible = $box.is(':visible');
        if (newOptions.parent && !boxVisible)
            ($parent = $(newOptions.parent)).append($box.add($overlay));

        /* Merge the new options with the existing ones */
        $.extend(options, newOptions);

        adjust();

        if (newOptions.handles != null) {
            /* Recreate selection area handles */
            $handles.remove();
            $handles = $([]);

            i = newOptions.handles ? newOptions.handles == 'corners' ? 4 : 8 : 0;

            while (i--)
                $handles = $handles.add(div());
            
            /* Add a class to handles and set the CSS properties */
            $handles.addClass(options.classPrefix + '-handle').css({
                position: 'absolute',
                /*
                 * The font-size property needs to be set to zero, otherwise
                 * Internet Explorer makes the handles too large
                 */
                fontSize: 0,
                zIndex: zIndex + 1 || 1
            });
            
            /*
             * If handle width/height has not been set with CSS rules, set the
             * default 5px
             */
            if (!parseInt($handles.css('width')) >= 0)
                $handles.width(5).height(5);
            
            /*
             * If the borderWidth option is in use, add a solid border to
             * handles
             */
            if (o = options.borderWidth)
                $handles.css({ borderWidth: o, borderStyle: 'solid' });

            /* Apply other style options */
            styleOptions($handles, { borderColor1: 'border-color',
                borderColor2: 'background-color',
                borderOpacity: 'opacity' });
        }

        /* Calculate scale factors */
        scaleX = options.imageWidth / imgWidth || 1;
        scaleY = options.imageHeight / imgHeight || 1;

        /* Set selection */
        if (newOptions.x1 != null) {
            setSelection(newOptions.x1, newOptions.y1, newOptions.x2,
                newOptions.y2);
            newOptions.show = !newOptions.hide;
        }

        if (newOptions.keys)
            /* Enable keyboard support */
            options.keys = $.extend({ shift: 1, ctrl: 'resize' },
                newOptions.keys);

        /* Add classes to plugin elements */
        $box.addClass(options.classPrefix + '-box-' + id);
        $overlay.addClass(options.classPrefix + '-outer');
        $area.addClass(options.classPrefix + '-selection');
        for (i = 0; i++ < 4;)
          $($border[i-1]).addClass(options.classPrefix + '-border' + i);

        /* Apply style options */
        styleOptions($area, { selectionColor: 'background-color',
          selectionOpacity: 'opacity' });
        styleOptions($border, { borderOpacity: 'opacity',
          borderWidth: 'border-width' });
        styleOptions($overlay, { outerColor: 'background-color',
          outerOpacity: 'opacity' });
        if (o = options.borderColor1)
          $($border[0]).css({ borderStyle: 'solid', borderColor: o });
        if (o = options.borderColor2)
          $($border[1]).css({ borderStyle: 'dashed', borderColor: o });


        /* Append all the selection area elements to the container box */
        $box.append($area.add($imgSelect).add($border).add($areaOpera)
            .add($handles));
        
        /* Set $boxes collection */
        $boxes = $('div.' + options.classPrefix + '-box-' + id);

        if ($.browser.msie) {
          if (o = $overlay.css('filter').match(/opacity=(\d+)/))
              $overlay.css('opacity', o[1]/100);
          if (o = $border.css('filter').match(/opacity=(\d+)/))
              $border.css('opacity', o[1]/100);
        }
        
        if (newOptions.hide)
            hide($box.add($overlay));
        else if (newOptions.show && imgLoaded) {
            shown = true;
            $box.add($overlay).fadeIn(options.fadeSpeed||0);
            doUpdate();
        }

        /* Calculate the aspect ratio factor */
        aspectRatio = (d = (options.aspectRatio || '').split(/:/))[0] / d[1];

        $img.add($overlay).unbind('mousedown', imgMouseDown);
        
        if (options.disable || options.enable === false) {
            /* Disable the plugin */
            $boxes.unbind('mousemove', areaMouseMove)
                .unbind('mousedown', areaMouseDown);
            $(window).unbind('resize', windowResize);
            $img.css({ cursor: '' });
        }
        else {
            if (options.enable || options.disable === false) {
                /* Enable the plugin */
                $box.unbind('mousedown', areaMouseDown)
                    .mousedown(areaMouseDown);
                if (options.resizable || options.movable) 
                    $box.unbind('mousemove', areaMouseMove)
                        .mousemove(areaMouseMove);
    
                $(window).resize(windowResize);
            }

            if (!options.persistent)
                $img.add($overlay).css({ cursor: 'crosshair' })
                    .mousedown(imgMouseDown);
        }

        options.enable = options.disable = undefined;
    }

    /**
     * Remove plugin completely
     */
    this.remove = function () {
        /*
         * Call setOptions with { disable: true } to unbind the event handlers
         */
        setOptions({ disable: true });
        $boxes.add($overlay).remove();
    };

    /*
     * Public API
     */

    /**
     * Get current options
     * 
     * @return An object containing the set of options currently in use
     */
    this.getOptions = function () { return options; };

    /**
     * Set plugin options
     * 
     * @param newOptions
     *            The new options object
     */
    this.setOptions = setOptions;

    /**
     * Get the current selection
     * 
     * @param noScale
     *            If set to <code>true</code>, scaling is not applied to the
     *            returned selection
     * @return Selection object
     */
    this.getSelection = getSelection;

    /**
     * Set the current selection
     * 
     * @param x1
     *            X coordinate of the upper left corner of the selection area
     * @param y1
     *            Y coordinate of the upper left corner of the selection area
     * @param x2
     *            X coordinate of the lower right corner of the selection area
     * @param y2
     *            Y coordinate of the lower right corner of the selection area
     * @param noScale
     *            If set to <code>true</code>, scaling is not applied to the
     *            new selection
     */
    this.setSelection = setSelection;
    
    /**
     * Cancel selection
     */
    this.cancelSelection = cancelSelection;
    
    /**
     * Update plugin elements
     * 
     * @param resetKeyPress
     *            If set to <code>false</code>, this instance's keypress
     *            event handler is not activated
     */
    this.update = doUpdate;
    
    
    /*
     * Multi Selection API methods
     *
     */
     
    /**
     * Add selection area
     * 
     * @param newOptions
     *            The new options object for the selection
     */
    this.addSelection = addSelection;
    
    /**
     * Remove selection area
     * 
     * @param index
     *            0-based position of selection to remove
     *            When not passed the current selection is removed
     *
     */
    this.removeSelection = removeSelection

    /**
     * Initiate selection area change
     * 
     * @param index
     *            0-based position of selection to activate
     * @return boolean success
     */
    this.activateSelection = function (index) {
        i = parseInt(index);
        
        if(isNaN(index) || index < 0 || index >= $boxes.length) 
            return false;
        
        swapSelection.call(this, $boxes.eq(i).data('selection'));
        return true;
    };

    /**
     * De-activate the current selection
     * 
     */
    this.deactivateSelection = function () {
        setSelectionState(false);
    };

    /**
     * Get all selection areas
     * 
     * @param noScale
     *            If set to <code>true</code>, scaling is not applied to the
     *            returned selection
     * @return array of Selection objects
     */
    this.getSelections = function (noScale) {
        var sx = noScale || scaleX, sy = noScale || scaleY;

        /* Save current selection */
        saveSelection();
        
        /* Return array of Selection objects from current boxes collection */
        return $boxes.map(
            function() { 
                var selection = $(this).data('selection').selection;
                return { x1: round(selection.x1 * sx),
                    y1: round(selection.y1 * sy),
                    x2: round(selection.x2 * sx),
                    y2: round(selection.y2 * sy),
                    width: round(selection.x2 * sx) - round(selection.x1 * sx),
                    height: round(selection.y2 * sy) - round(selection.y1 * sy),
                    zindex: parseInt($box.css('z-index'))-2 };
            }).get();
    };

    /**
     * Move current selection to front by incrementing zIndex
     * 
     */
    this.moveToFront = function() {
        $box.css('z-index', parseInt($box.css('z-index')) + 1);
    };

    /**
     * Move current selection to back by decrementing zIndex
     * 
     */
    this.moveToBack = function() {
        var z = parseInt($box.css('z-index'));
        
        /* zIndex cannot fall below calculated zIndex global +2 */
        $box.css('z-index', --z < zIndex+2 ? zIndex+2 : z);
    };

    /* 
     * Traverse the image's parent elements (up to <body>) and find the
     * highest z-index
     */
    $p = $img;

    while ($p.length) {
        zIndex = max(zIndex,
            !isNaN($p.css('z-index')) ? $p.css('z-index') : zIndex);
        /* Also check if any of the ancestor elements has fixed position */ 
        if ($p.css('position') == 'fixed')
            position = 'fixed';

        $p = $p.parent(':not(body)');
    }
    
    /*
     * If z-index is given as an option, it overrides the one found by the
     * above loop
     */
    zIndex = options.zIndex || zIndex;

    if ($.browser.msie)
        $img.attr('unselectable', 'on');

    /*
     * In MSIE and WebKit, we need to use the keydown event instead of keypress
     */
    $.imgAreaSelect.keyPress = $.browser.msie ||
        $.browser.safari ? 'keydown' : 'keypress';

    /*
     * There is a bug affecting the CSS cursor property in Opera (observed in
     * versions up to 10.00) that prevents the cursor from being updated unless
     * the mouse leaves and enters the element again. To trigger the mouseover
     * event, we're adding an additional div to $box and we're going to toggle
     * it when mouse moves inside the selection area.
     */
    if ($.browser.opera)
        $areaOpera = div().css({ width: '100%', height: '100%',
            position: 'absolute', zIndex: zIndex + 2 || 2 });

    /*
     * If the image has been fully loaded, or if it is not really an image (eg.
     * a div), call imgLoad() immediately; otherwise, bind it to be called once
     * on image load event.
     */
    img.complete || img.readyState == 'complete' || !$img.is('img') ?
        imgLoad() : $img.one('load', imgLoad);

    /* 
     * MSIE 9.0 doesn't always fire the image load event -- resetting the src
     * attribute seems to trigger it. The check is for version 7 and above to
     * accommodate for MSIE 9 running in compatibility mode.
     */   
   if (!imgLoaded && $.browser.msie && $.browser.version >= 7)
        img.src = img.src;
};

/**
 * Invoke imgAreaSelect on a jQuery object containing the image(s)
 * 
 * @param options
 *            Options object
 * @return The jQuery object or a reference to imgAreaSelect instance (if the
 *         <code>instance</code> option was specified)
 */
$.fn.imgAreaSelect = function (options) {
    options = options || {};

    this.each(function () {
        /* Is there already an imgAreaSelect instance bound to this element? */
        if ($(this).data('imgAreaSelect')) {
            /* Yes there is -- is it supposed to be removed? */
            if (options.remove) {
                /* Remove the plugin */
                $(this).data('imgAreaSelect').remove();
                $(this).removeData('imgAreaSelect');
            }
            else
                /* Reset options */
                $(this).data('imgAreaSelect').setOptions(options);
        }
        else if (!options.remove) {
            /* No existing instance -- create a new one */
            
            /*
             * If neither the "enable" nor the "disable" option is present, add
             * "enable" as the default
             */ 
            if (options.enable === undefined && options.disable === undefined)
                options.enable = true;

            $(this).data('imgAreaSelect', new $.imgAreaSelect(this, options));
        }
    });
    
    if (options.instance)
        /*
         * Return the imgAreaSelect instance bound to the first element in the
         * set
         */
        return $(this).data('imgAreaSelect');

    return this;
};

})(jQuery);
