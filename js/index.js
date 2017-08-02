const svgns = 'http://www.w3.org/2000/svg';
const mainSVG = document.getElementById('main');

const distance = ({x:x1, y:y1}, {x:x2, y:y2}) => Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);

const toSvgPoint = (svg, {x, y}) => {
    const p = svg.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(svg.getScreenCTM().inverse());
};

const pathRadiusBuffer = (path, radius=10) => {
    const outsideRadius = Kefir.combine([path.take(1), path.skip(1)], distance)
        .filter(dist => dist >= radius);
    const insideChunk = path.bufferBy(outsideRadius, {flushOnEnd:false}).take(1);
    const outside = path.skipUntilBy(insideChunk);
    return Kefir.concat([insideChunk.flatten(), outside]);
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
const touchDrawPathStops = Kefir.merge([touchEnds, touchCancels, multiTouchStarts]);

const touchDrawPaths = singleTouchStarts
    .map(touchStart => touchMoves
        .takeUntilBy(touchDrawPathStops)
        .toProperty(_ => touchStart)
        .onValue(event => event.preventDefault())
        .map(( {touches:[ {clientX:x, clientY:y} ]} ) => ( {x, y} )))
    .map(pathRadiusBuffer);

const drawPaths = Kefir.merge([touchDrawPaths, mouseDrawPaths]).map(path => path
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