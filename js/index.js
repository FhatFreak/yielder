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

const mouseDrawPaths = mouseDowns.map(mouseDown => mouseMoves
    .takeUntilBy(mouseUps)
    .toProperty(_ => mouseDown)
    .map(( {clientX:x, clientY:y} ) => ( {x, y} )));

const touchStarts = Kefir.fromEvents(mainSVG, 'touchstart');
const touchMoves = Kefir.fromEvents(mainSVG, 'touchmove');
const touchEnds = Kefir.fromEvents(mainSVG, 'touchend');
const touchCancels = Kefir.fromEvents(mainSVG, 'touchcancel');

const singleTouchStarts = touchStarts.filter(touchStart => touchStart.touches.length == 1);
const multiTouchStarts = touchStarts.filter(touchStart => touchStart.touches.length > 1);
const touchDrawPathstops = Kefir.merge([touchEnds, touchCancels, multiTouchStarts]);

const touchDrawPaths = singleTouchStarts.map(touchStart => {
    const {touches:[ {clientX:x0, clientY:y0} ]} = touchStart;
    const path = touchMoves
        .takeUntilBy(touchDrawPathstops)
        .toProperty(_ => touchStart)
        .onValue(event => event.preventDefault())
        .map(( {touches:[ {clientX:x, clientY:y} ]} ) => ( {x, y} ));

    const radius = 10;
    const outsideRadius = path
        .filter(( {x, y} ) => Math.sqrt((x - x0)**2 + (y - y0)**2) >= radius)
        .take(1);

    return path
        .bufferBy(outsideRadius, {flushOnEnd:false})
        .flatten()
        .concat(path.skipUntilBy(outsideRadius));
});

const drawPaths = Kefir.merge([touchDrawPaths, mouseDrawPaths])
    .map(path => path
        .skipDuplicates(( {x:x1, y:y1}, {x:x2, y:y2} ) => x1 === x2 && y1 === y2)
        .map(point => toSvgPoint(mainSVG, point)));

drawPaths.onValue(path => path
    .slidingWindow(2, 2)
    .onValue(( [{x:x1, y:y1}, {x:x2, y:y2}] ) => {
        const line = document.createElementNS(svgns, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'black');
        mainSVG.appendChild(line);
    }));