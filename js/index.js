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

const drawPaths = Kefir.merge([touchDrawPaths, mouseDrawPaths])
    .map(path => path
        .skipDuplicates(( {x:x1, y:y1}, {x:x2, y:y2} ) => x1 === x2 && y1 === y2)
        .map(point => toSvgPoint(mainSVG, point)));

const linearLeastSquares = (path) => {
    //see: https://en.wikipedia.org/wiki/Linear_least_squares_(mathematics)
    const S = path.scan(( {b1_2, b2_2, b1b2, b1, b2, c}, {x, y} ) => {
        return {
            b1_2: b1_2 + 1,
            b2_2: b2_2 + x*x,
            b1b2: b1b2 + 2*x,
            b1: b1 + -2*y,
            b2: b2 + -2*x*y,
            c: c + y*y
        };
    }, {b1_2:0, b2_2:0, b1b2:0, b1:0, b2:0, c:0});

    const dS_db1 = S.map(( {b1_2, b2_2, b1b2, b1, b2, c} ) => {
        return {
            b1: 2*b1_2,
            b2: b1b2,
            c: b1
        };
    });

    const dS_db2 = S.map(( {b1_2, b2_2, b1b2, b1, b2, c} ) => {
        return {
            b1: b1b2,
            b2: 2*b2_2,
            c: b2
        };
    });

    return Kefir.zip([dS_db1, dS_db2], ( {b1:a, b2:b, c:c}, {b1:x, b2:y, c:z} ) => {
        //TODO: check for no solutions/infinite solutions/vetical lines
        const eq1 = [a,b,-c];
        const eq2 = [x,y,-z];
        const [i,j,k] = eq1.map((num, ix) => -x/a * num + eq2[ix]);
        const b2 = k/j;
        const b1 = -(c+b*b2)/a;
        return {b2, b1};
    });
};

//drawPaths
const test = Kefir.sequentially(1, [
    {x:1, y:6},
    {x:2, y:5},
    {x:3, y:7},
    {x:4, y:10}
]);

drawPaths
    .map(linearLeastSquares)
    .onValue(fits => fits
        .filter(( {b2, b1} ) => !isNaN(b2) && !isNaN(b1))
        .map(( {b2, b1} ) => {
            const x = 200;
            const y = x*b2 + b1
            const line = document.createElementNS(svgns, 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', b1);
            line.setAttribute('x2', x);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', 'red');
            return line;
        })
        .slidingWindow(2, 2)
        .onValue(( [prev, next] ) => {
            prev.remove();
            mainSVG.appendChild(next);
        }));

drawPaths
    .onValue(path => path
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