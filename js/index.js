const svgns = 'http://www.w3.org/2000/svg';
const mainSVG = document.getElementById('main');

const toSvgPoint = (svg, {x,y}) => {
    const p = svg.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(svg.getScreenCTM().inverse());
};

const mouseDowns = Kefir.fromEvents(mainSVG, 'mousedown');
const mouseMoves = Kefir.fromEvents(document, 'mousemove');
const mouseUps = Kefir.fromEvents(document, 'mouseup');

const mouseDrags = mouseDowns.map(downEvent => mouseMoves
    .toProperty(_ => downEvent)
    .takeUntilBy(mouseUps)
    .map(( {clientX:x, clientY:y} ) => ( {x, y} )));

const touchStarts = Kefir.fromEvents(mainSVG, 'touchstart');
const touchMoves = Kefir.fromEvents(mainSVG, 'touchmove');
const touchEnds = Kefir.fromEvents(mainSVG, 'touchend');
const touchCancels = Kefir.fromEvents(mainSVG, 'touchcancel');

const singleTouchStarts = touchStarts.filter(event => event.touches.length == 1);
const multiTouchStarts = touchStarts.filter(event => event.touches.length > 1);
const touchDragStops = Kefir.merge([touchEnds, touchCancels, multiTouchStarts]);

const touchDrags = singleTouchStarts.map(touchStart => {
    const {touches:[ {clientX:x0, clientY:y0} ]} = touchStart;
    const drag = touchMoves
        .takeUntilBy(touchDragStops)
        .toProperty(_ => touchStart)
        .onValue(event => event.preventDefault())
        .map(( {touches:[ {clientX:x, clientY:y} ]} ) => ( {x, y} ));

    const radius = 10;
    const outsideRadius = drag
        .filter(( {x, y} ) => Math.sqrt((x - x0)**2 + (y - y0)**2) >= radius)
        .take(1);

    return drag
        .bufferBy(outsideRadius, {flushOnEnd:false})
        .flatten()
        .concat(drag.skipUntilBy(outsideRadius));
});

const drags = Kefir.merge([touchDrags, mouseDrags])
    .map(drag => drag
        .skipDuplicates(( {x:x1, y:y1}, {x:x2, y:y2} ) => x1 === x2 && y1 === y2)
        .map( point => toSvgPoint(mainSVG, point)));

drags.onValue(drag => drag
    .slidingWindow(2, 2)
    .onValue(points => {
        const [{x:x1, y:y1}, {x:x2, y:y2}] = points;
        const line = document.createElementNS(svgns, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'black');
        mainSVG.appendChild(line);
    }));