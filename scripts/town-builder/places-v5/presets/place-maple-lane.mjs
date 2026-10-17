// Maple Lane: a whole residential block built the way the owner built block B3 (x75-145, y115-185).
// Three homes face the south street, one faces the east street, two show their backs to the viewer from the north street.
// Lot lines at u 23 and u 46 (owner lots are ~22-23 m wide); the mid-block back fence runs along v 34.7.
// Placement rules learned from close-ups: the house art already paints foundation planting, porch pumpkins and lights,
// so fronts get complements (end shrubs tight to the wall, a walk lined up with the real steps, yard pieces on the lawn);
// plants against a fence stand 0.9 m off it; nothing that matters goes in the ~18 m screen-shadow behind a house.
import {Preset} from '../kit.mjs';
import {bed,decals,gutter,home} from '../lib.mjs';
const W=(use,look)=>({use,look});

export default function(){
 const fit={w:69.4,h:69.4},P=Preset({id:'place-maple-lane',name:'Maple Lane (whole block)',fit,
  desc:'Six family homes filling a 69 m road block: three facing the south street, one facing east, two backing onto the block from the north street. Every yard fenced, every backyard a different family.',
  story:'An ordinary October evening on Maple Lane. The Kowalskis\' kids have the trampoline and the dog; the Hendersons grow tomatoes under glass; Mr. Ruiz is always fixing something; the Bakers\' pool is covered for winter; the Pruitts are camping out in their own yard; old Mrs. Abbott keeps hounds and rabbits.'});
 const walk=(h,why)=>{const [du,dv]=h.step;return h.flip?P.pave({u0:du,v0:dv-.8,u1:fit.w,v1:dv+.8,why}):P.pave({u0:du-.8,v0:dv,u1:du+.8,v1:fit.h,why});};

 // ---------------------------------------------------------------- shared lot lines
 P.section('Lot lines');
 const lotLine=W('separates neighbours\' backyards so kids and dogs stay home, as on every lot the owner fenced','a pale wooden wall that cuts the block into readable rooms and gives each yard a backdrop');
 P.run('privacy',[0,34.7],[46,34.7],{why:lotLine});
 P.run('privacy',[46,34.7],[69.4,34.7],{why:lotLine});
 P.run('privacy',[23,35.2],[23,55],{why:lotLine});
 P.run('privacy',[46,35.2],[46,55],{why:lotLine});
 P.run('privacy',[23,2],[23,34.2],{why:lotLine});
 P.run('privacy',[46,2],[46,34.2],{why:lotLine});

 // ---------------------------------------------------------------- Lot A: the Kowalskis, south-west corner, kids and dog
 P.section('Lot A front: the Kowalskis (south-west corner)');
 const A=home('gen:house-splitlevel',10.5,58.4);
 P.put(A.id,A.u,A.v,{why:W('the family home, front door facing Maple Lane like its neighbours','a split-level roof line breaks the row so the corner does not read as a copy of the next house')});
 walk(A,W('the front walk from the steps straight to the sidewalk','a pale line that leads the eye from the street to the door'));
 bed(P,['town:fern','town:hydrangea','town:hydrangea'],[A.ends[1][0]-3.2,A.wall+.9],[A.ends[1][0]+.4,A.wall+1.6],3,W('hydrangeas against the right half of the facade, where the painted planter stops','tight to the wall like the owner\'s, so the house sits in its planting instead of on bare lawn'),{seed:11});
 P.put('ref:halloween-mums',A.step[0]-1.4,A.wall+2.6,{why:W('potted mums set beside the walk where visitors pass','a block of orange that frames the path at the foot of the steps')});
 P.put('ref:halloween-mums',A.step[0]+1.4,A.wall+2.6,{flip:true,why:W('the matching pot on the other side of the walk','a pair reads as deliberate porch dressing, not a dropped pot')});
 P.put('world:pumpkin_0',A.step[0]-1.6,67.4,{mul:.75,why:W('a big carved pumpkin at the walk end, the first thing trick-or-treaters see','a glowing marker at the sidewalk that pulls the eye into the lot')});
 P.put('static:compact_e',19.2,59.4,{flip:true,why:W('the family car, parked on the grass beside the house because there is no garage','a warm red shape between two houses fills the gap the eye would otherwise fall into')});
 decals(P,[[19.4,63.6,'town:wheel_wear',1,true],[19.4,66.2,'town:wheel_wear',1,true],[17.6,64.6,'gen:drift-8',.95],[21,62,'gen:drift-8',.9]],W('ruts and crushed leaves where the car is driven onto the lawn every evening','tells the story of the car without a driveway, as the owner does in B3'));
 P.put('world:mailbox',A.step[0]+1.5,68.6,{why:W('the mailbox at the end of the walk, by the curb for the mail carrier','a small dark post marking where the lot meets the sidewalk')});
 P.put('ref:tree-maple-crimson',3.2,66.2,{mul:1.05,why:W('the street tree on the corner, the one every kid climbs','the strongest red in the block, at the corner where the eye enters')});
 P.put('gen:lawnmower',10.4,38.4,{why:W('pushed to the back fence after the last mow of the year','a small red accent on the open corner lawn')});
 P.put('world:tree_pine_1',.5,57.4,{mul:.8,why:W('a windbreak pine on the corner, planted when the house was built','a dark vertical that closes the open west side of the corner')});
 P.run('chain',[0,36],[0,64.5],{why:W('the corner lot\'s side boundary along the west street, cheap and see-through like the owner\'s','a light mesh line keeps the corner open but clearly owned')});
 decals(P,[[4.8,68.4,'gen:drift-3',1],[1.6,64.6,'town:leaf_drift',1.3],[6.4,62.6,'decal:decal-07-red-leaf-cluster',1],[13,66.8,'gen:drift-6',.6],[21.2,67.8,'gen:drift-6',.6]],W('leaves from the corner maple blown against the house and the fence','the red tree is repeated on the ground so it belongs to the lot'));

 P.section('Lot A back: trampoline, dog and bikes');
 P.put('expansion:trampoline',15.2,44.2,{why:W('the kids\' trampoline, kept well away from the house windows','a big dark circle that anchors the middle of the yard')});
 P.put('expansion:doghouse',4.8,40.8,{flip:true,why:W('the dog\'s house against the back fence where it is sheltered','a small red roof that leads the eye into the back corner')});
 P.put('expansion:sandbox',8.6,47.6,{mul:.9,why:W('a sandbox for the youngest, in sight of the kitchen window','a pale square that brightens the dark lawn')});
 P.put('expansion:wagon',12.6,49.6,{why:W('the kids\' red wagon left beside the sandbox','a bright toy clear of the house so the roof does not hide it')});
 P.put('expansion:tricycle',5.4,46.2,{why:W('the toddler\'s trike between the sandbox and the side gate','a tiny red detail the eye finds after the trampoline')});
 P.put('gen:kids-bikes',19.4,51.4,{why:W('bikes dropped by the side gate after school','scattered spokes make the yard look lived in')});
 P.put('gen:trash-cans-row',21.2,54.2,{flip:true,why:W('the family\'s bins by the side gate next to the car, ready to roll out','a grey cluster at the end of the house, clear of the fence top')});
 P.put('ref:tree-birch-gold',2.4,49.4,{why:W('a birch in the back corner for shade over the sandbox','a tall gold column against the dark pines of the next yard')});
 P.put('world:tree_pine_1',21.2,38.6,{mul:.85,why:W('a pine in the back corner where three yards meet','a dark spire that marks the lot corner from above, as the owner does')});
 bed(P,['world:bush_2','town:fern','world:bush_0','town:ornamental_grass'],[3,35.6],[13.6,35.6],4,W('shrubs grown up against the back fence','dark mounds hugging the long fence so its foot is not a hard line'),{seed:51});
 decals(P,[[10.5,44,'decal:scatter-tiny-leaves',1],[3.5,46,'gen:drift-6',.55],[17,39,'gen:drift-2',.8],[7,38.6,'gen:drift-3',1],[12,40,'town:leaf_drift',1.1],[2,44,'gen:drift-8',.9]],W('leaves fallen from the birch and blown into the yard\'s corners','warm patches that tie the trees to the ground'));

 // ---------------------------------------------------------------- Lot B: the Hendersons, the gardeners
 P.section('Lot B front: the Hendersons');
 const B=home('world:house_1',34.4,56.6);
 P.put(B.id,B.u,B.v,{why:W('a two-storey family house facing Maple Lane','the tallest roof in the south row, centred, gives the street its middle')});
 walk(B,W('the front walk from the porch steps to the gap in the fence','a pale line leading the eye straight to the door'));
 P.run('chain',[24,69],[45,69],{skip:[3],why:W('a low chain-link along the front with a gap at the walk, as the owner fenced lot B3-mid','a fine bright line that frames the front yard against the sidewalk')});
 bed(P,['world:bush_0','world:bush_2','world:bush_1'],[25.4,68],[29,68],2,W('shrubs behind the front fence, left of the walk','a soft dark band that doubles the fence line'),{seed:23,mul:[.85,1.05],flip:false});
 bed(P,['world:bush_0','world:bush_2','world:bush_0'],[34.8,67.6],[43.6,67.6],4,W('shrubs behind the front fence, right of the walk','the same hedge continues so the walk reads as a gap through it'),{seed:24,mul:[.85,1.05],flip:false});
 P.put('ref:halloween-sheet-ghost',27.4,64.6,{mul:.95,why:W('a homemade sheet ghost on a stake in the front lawn','a pale figure on the dark lawn, read instantly as Halloween')});
 P.put('world:pumpkin_1',B.step[0]+1.2,65.2,{mul:.7,why:W('a carved pumpkin beside the walk, lit for the evening','a warm point halfway between the street and the door')});
 P.put('world:car_2',43.4,57.4,{flip:true,why:W('the family wagon pulled up beside the house','a second car colour in the row, between lots B and C')});
 decals(P,[[43.6,61.8,'town:oil_stain',1],[42.6,64.6,'town:puddle',.8],[43.6,66.8,'town:wheel_wear',1,true]],W('where the car stands every night it leaks a little oil','dark spots that make the parking spot believable'));
 P.put('expansion:hydrant-yellow',33,70.6,{street:true,why:W('a hydrant at the sidewalk edge, as the owner put one mid-block','a yellow spark on the grey sidewalk')});
 decals(P,[[29,65.8,'gen:drift-3',.9],[39,65.6,'town:leaf_drift',1.1],[26.5,59.6,'town:leaf_drift',1]],W('leaves caught behind the front hedge','warm litter that keeps the lawn from looking mown flat'));

 P.section('Lot B back: the greenhouse garden');
 P.put('expansion:glasshouse',34.6,40.4,{why:W('Mr. Henderson\'s greenhouse at the sunny back of the lot','a glowing glass box that is the lot\'s landmark from above')});
 P.put('expansion:compost-bin',26.8,36.4,{why:W('compost in the far corner, out of smell range of the house','a small dark block that weighs down the corner')});
 P.put('expansion:rain-barrel',39.8,42.4,{why:W('a rain barrel collecting water off the greenhouse roof','a round dark shape beside the glass')});
 P.put('expansion:garden-hose',30.6,44.6,{why:W('the hose reel near the greenhouse door','green coil detail for close viewing')});
 P.put('gen:wheelbarrow-leaves',27.4,41.6,{flip:true,why:W('a barrow of raked leaves on the way to the compost','a heap of orange that echoes the street trees')});
 P.put('expansion:rototiller',42.6,38,{why:W('the tiller parked by the vegetable beds','a mechanical shape against the soft plants')});
 P.put('expansion:ivy-arbor',31.4,46.4,{why:W('an ivy arbour over the path from the back door to the greenhouse','a green gateway that frames the garden from the house side')});
 P.put('expansion:birdhouse-post',37.2,47.4,{why:W('a birdhouse on a post that Mrs. Henderson watches from the kitchen','a thin vertical between the beds')});
 P.put('expansion:leaf-bags',44.6,36,{why:W('raked leaves bagged against the back fence','brown lumps that weigh down the corner')});
 P.put('world:tree_oak_2',27.4,47,{mul:.8,why:W('an old oak that shades the kitchen side of the house','a broad orange crown filling the gap between the two houses from above')});
 bed(P,['town:hydrangea','town:ornamental_grass','town:fern'],[23.9,36.4],[23.9,39],2,W('a border planted along the lot-line fence','green hugging the fence so the wall is not bare'),{seed:52});
 decals(P,[[32,46,'decal:decal-03-moss-groundcover',1],[38,44.4,'town:bare_grass',.9],[36,37.4,'gen:drift-8',.9]],W('worn earth paths and moss where the gardener walks','breaks the lawn into the shapes of a used garden'));

 // ---------------------------------------------------------------- Lot C: the Ruiz place, south-east corner, the fix-it lot
 P.section('Lot C front: the Ruiz place (south-east corner)');
 const C=home('gen:house-l-shape',55.6,58.2);
 P.put(C.id,C.u,C.v,{why:W('the corner house with its own double garage, facing Maple Lane','the L wing and garage step the roofs down toward the corner')});
 const [ga,gb]=C.garage.a;
 P.lot({surface:'asphalt',u0:ga[0]+.2,v0:ga[1],u1:gb[0]-.2,v1:70.6,openings:[{side:'S',a0:ga[0]+.4,a1:gb[0]-.4}],why:W('the driveway from the built-in garage doors to Maple Lane','a dark strip that connects the house to the road')});
 P.put('static:pickup_n-v2',(ga[0]+gb[0])/2,66,{why:W('Mr. Ruiz\'s pickup on the drive, the garage too full of projects to park in','a work vehicle that tells the lot\'s story from the street')});
 decals(P,[[(ga[0]+gb[0])/2-1,68.6,'town:oil_stain',1],[(ga[0]+gb[0])/2+1.4,63.8,'town:paving_wear',1]],W('oil and wear on the drive under the pickup','makes the asphalt feel used'));
 walk(C,W('the walk from the front door to the sidewalk','separates the lawn from the drive'));
 P.put('gen:yard-tombstones',51.6,65.6,{why:W('foam tombstones the kids set out on the front lawn','a cluster of pale shapes that says Halloween from far away')});
 P.put('ref:halloween-mums',C.step[0]+1.3,C.wall+2.4,{why:W('mums by the front walk','orange at the foot of the steps')});
 P.put('world:trashcan',gb[0]+.6,68.4,{why:W('the bin wheeled out beside the drive for the morning pickup','a dark vertical at the drive mouth')});
 P.run('picket',[68.6,36],[68.6,67],{why:W('a white picket along the side street from the back fence to the corner','wraps the corner so the lot reads as one property')});
 bed(P,['world:bush_1','town:ornamental_grass','world:bush_0'],[67.6,52],[67.6,64],3,W('shrubs inside the side picket','soft green behind the white fence'),{seed:31,flip:false});
 P.put('world:hydrant',68.6,70.4,{street:true,why:W('the corner hydrant','red at the corner, where the owner always puts one')});
 decals(P,[[48.6,66.6,'gen:drift-3',.85],[63.8,66.4,'town:leaf_drift',1.2],[62,62.6,'gen:drift-6',.6]],W('leaves blown against the house and the fence','warm colour on the front lawn'));

 P.section('Lot C back: the workshop yard');
 P.put('expansion:lean-to-shed',65.2,40.6,{flip:true,why:W('a lean-to against the back fence where the lumber is kept dry','a sloping roof that fills the back corner')});
 P.put('expansion:lumber-bundle',59.6,38.6,{why:W('boards for the next project','long pale shapes that point along the fence')});
 P.put('expansion:yard-workbench',56.4,42.4,{why:W('the outdoor workbench behind the garage','a table of tools; the lot\'s activity centre')});
 P.put('expansion:utility-trailer',50.6,40.4,{why:W('a trailer for hauling, parked in the back','a big low shape that fills the middle of the yard')});
 P.put('expansion:tyre-stack',63,46.4,{why:W('old tyres waiting to go to the dump','black circles at the yard\'s open side')});
 P.put('expansion:oil-drums',67.2,46.6,{mul:.85,why:W('drums of used oil from the pickup','a dull red-and-rust cluster in the corner')});
 P.put('expansion:pallet-stack',53.4,36.2,{mul:.85,why:W('pallets saved for firewood','a slatted block against the back fence')});
 P.put('expansion:cement-bags',58.2,41.6,{why:W('cement for the patio he will pour next spring','grey bags beside the workbench')});
 P.put('world:tree_dead_1',66.4,37,{mul:.9,why:W('a dead elm nobody has cut down yet','a black twisted silhouette in the corner; Halloween in a tree')});
 P.put('world:tree_pine_2',51.6,45.2,{why:W('a pine planted along the lot line for privacy from lot B','a dark spire that separates the two backyards from above')});
 decals(P,[[56,40,'town:mud_grass',1],[60,43,'expansion:mud-tracks-x',1],[52.5,46,'gen:pinecones-needles',1],[66,44,'gen:twigs-branches',1]],W('mud from wheeling the trailer in and out, twigs from the dead elm','the worn ground of a working yard'));

 // ---------------------------------------------------------------- Lot D: the Bakers, faces the east street (north-east quarter)
 P.section('Lot D front: the Bakers (faces the east street)');
 const D=home('world:house_4',58.4,19.6,{flip:true});
 P.put(D.id,D.u,D.v,{flip:true,why:W('a one-storey house whose front door faces the east street','flipped so its porch looks out to the side street, as the owner turns east-side houses')});
 walk(D,W('the walk from the east porch to the sidewalk','leads the eye from the side street to the door'));
 P.put('static:garage_timber',59.4,6.6,{flip:true,why:W('a timber garage opening onto the east street','a grey block that closes the north-east corner of the block')});
 P.lot({surface:'asphalt',u0:63.6,v0:3.8,u1:71,v1:9.4,why:W('the driveway out to the east street','a dark strip leading out of the corner')});
 P.put('static:compact_n-v2',66.8,6.6,{flip:true,why:W('the Bakers\' small car on the drive','a compact shape on the dark drive')});
 P.run('picket',[68.6,13.2],[68.6,33.8],{skip:[0],why:W('a picket fence along the east street with a gate gap at the walk','matches lot C so the side street reads as one tidy run')});
 P.put('expansion:blowmold-ghost',66.6,25.4,{mul:.6,why:W('a light-up plastic ghost on the side lawn','a glowing white figure facing the side street')});
 P.put('ref:tree-maple-crimson',66.4,30,{mul:1.3,why:W('a maple at the corner of the east lawn','a red crown that balances the maple on the opposite corner')});
 bed(P,['town:hydrangea','town:fern'],[66.6,D.step[1]+2.4],[66.6,D.step[1]+4.4],2,W('a shrub pair beside the walk where it meets the sidewalk','frames the gate gap so the walk reads as an entrance'),{seed:41});
 decals(P,[[66,32,'gen:drift-3',1.1],[64,27,'town:leaf_drift',1.2],[66.6,13,'gen:drift-6',.6]],W('maple leaves under the tree','the red is repeated on the ground'));

 P.section('Lot D back: the covered pool');
 P.put('expansion:aboveground-pool',51.8,26.2,{why:W('an above-ground pool, closed for the season','a big round shape that is the backyard\'s landmark')});
 P.put('expansion:patio-swing',48.8,16.4,{why:W('a patio swing by the back door','a canopy shape against the house')});
 P.put('expansion:brick-barbecue',49.6,10.4,{why:W('a brick barbecue built by the kitchen door','a solid red block that anchors the patio corner')});
 P.put('gen:cooler-lawnchairs',56.2,27.4,{why:W('chairs left out by the pool since August','a bright cluster that says summer is over')});
 P.put('expansion:leaf-bags',49.2,33,{why:W('bags of raked leaves against the back fence','brown lumps lining the fence')});
 P.put('ref:tree-birch-gold',48.6,8,{why:W('a birch on the lot line beside the garage','a gold column in the north-east quarter')});
 P.put('world:tree_pine_1',47.4,22,{mul:.9,why:W('a pine on the lot line toward lot F','a dark divider between the two north yards')});
 bed(P,['world:bush_1','world:bush_2'],[50.4,33.6],[53.6,33.6],2,W('shrubs at the back fence corner','fill the dead corner by the fence'),{seed:53});
 decals(P,[[55,31,'gen:drift-8',.9],[49.5,22,'decal:scatter-tiny-leaves',1],[60,25.6,'town:leaf_drift',1],[52.6,5,'gen:drift-8',.9]],W('leaves across the pool deck','autumn on the summer things'));

 // ---------------------------------------------------------------- Lot E: the Pruitts, north-west, house back to the viewer
 P.section('Lot E: the Pruitts (front on the north street, backyard toward the viewer)');
 P.put('gen:back-swingset',11.6,11.6,{why:W('the Pruitts\' house seen from the back: its front faces the north street, its swing set and back door face the yard','one of the owner\'s own house backs, at the scale it has on the map')});
 P.run('chain',[1.5,.6],[21.8,.6],{skip:[4,5],why:W('a chain-link along the north street with a gap for the front walk','a light line marking the lot from the north street')});
 P.put('world:tree_pine_1',1.4,4.4,{mul:1.2,why:W('pines on the north-west corner, as the owner clusters them','a dark mass that frames the block\'s far corner')});
 P.put('world:tree_pine_1',.6,7.2,{mul:.95,why:W('the second pine of the corner group','varied heights so the group reads as natural')});
 P.put('world:tree_pine_0',1.6,14.8,{mul:1.05,why:W('the third pine stepping down the west street','closes the west side behind the house')});
 P.put('expansion:backyard-tent',8.6,26,{why:W('a tent pitched for a backyard camp-out','an orange triangle in the middle of the yard')});
 P.put('expansion:firepit',13.4,28.6,{mul:1.5,why:W('a fire pit with logs for toasting marshmallows','a warm circle beside the tent')});
 P.put('expansion:lawn-chair',16.4,26.6,{why:W('a chair by the fire','a small seat that makes the fire a gathering')});
 P.put('expansion:camping-cooler',10.8,29.6,{why:W('the cooler for the camp-out','a small bright box by the tent')});
 P.put('expansion:backyard-telescope',16.8,23,{why:W('a telescope set up to watch the stars','a thin tripod silhouette, clear of the house roof')});
 P.put('expansion:rocket-playfort',4.6,22,{why:W('the kids\' rocket playfort','a tall bright toy that reads from far away')});
 P.put('expansion:soapbox-racer',12.8,18.4,{why:W('a soapbox car the kids are building, by the back porch','a bright toy near the back door')});
 P.put('world:tree_pine_1',21.4,24.6,{mul:.9,why:W('a pine on the lot line between E and F','splits the two north yards from above')});
 P.put('ref:tree-birch-gold',6,32.2,{why:W('a birch at the back corner','gold against the dark pines')});
 P.put('town:ornamental_grass',.9,31.4,{why:W('grass clump at the west fence corner','softens the corner where the fences meet')});
 bed(P,['world:bush_0','town:fern'],[14.6,33.8],[19.6,33.8],2,W('shrubs along the back fence','soften the fence foot'),{seed:54});
 P.run('chain',[0,17],[0,34],{why:W('the west street boundary of the corner lot','continues the corner treatment of lot A, one fence along the whole side street')});
 decals(P,[[10.5,31,'gen:pinecones-needles',1.2],[4,18,'gen:pinecones-needles',1],[16,22,'gen:drift-3',.9],[7,20,'town:leaf_drift',1]],W('needles and cones from the corner pines, leaves from the birch','the trees repeated on the ground'));

 // ---------------------------------------------------------------- Lot F: Mrs. Abbott, north-middle, house back to the viewer
 P.section('Lot F: Mrs. Abbott\'s animals (front on the north street)');
 P.put('gen:back-shed-garden',34.8,11,{flip:true,why:W('Mrs. Abbott\'s cottage seen from the back, its front on the north street, garden shed beside it','the owner\'s own house back, mirrored the way the owner placed it in B3')});
 P.put('expansion:kennel',28.6,25.6,{why:W('a dog run at the back of the yard for her old hounds, away from the house','a long fenced box that is the yard\'s landmark')});
 P.put('ref:halloween-hay-bales',25.8,20.2,{why:W('straw for the kennel and hutch bedding','a golden block beside the run')});
 P.put('expansion:rabbit-hutch',31.6,19.2,{why:W('a rabbit hutch near the coop','another animal home: the lot is about animals')});
 P.put('expansion:washing-line',39.8,21.6,{why:W('washing hung out behind the cottage','a line of pale cloth that catches the eye')});
 P.put('expansion:wooden-well',44.2,26.4,{why:W('an old well from when this was farmland, in the back corner','a round stone shape, set clear of the cottage roof')});
 P.put('expansion:pallet-stack',45.4,16.6,{why:W('pallets stacked against the lot-line fence for winter kindling','a slatted block hugging the fence')});
 P.put('world:tree_oak_1',26,31,{mul:.85,why:W('an old oak in the back corner shading the coop','a wide orange crown that fills the space above the yard')});
 P.put('ref:tree-maple-crimson',41.6,30,{mul:1.1,why:W('a maple near the well','a red crown in the north half to answer the corner maples')});
 bed(P,['town:hydrangea','town:hydrangea','town:fern'],[30.4,16.4],[39.6,16.4],3,W('old hydrangeas along the back of the cottage','soft colour under the rear windows'),{seed:55});
 P.run('chain',[24.2,.6],[44.8,.6],{skip:[5],why:W('chain-link along the north street matching lot E','one line along the whole north street')});
 P.put('expansion:rural-mailboxes',30.8,.2,{why:W('the mailbox post at the north sidewalk','a small detail on the far street')});
 decals(P,[[33,27,'town:mud_grass',1],[29,30,'town:bare_grass',.9],[38,30,'gen:drift-7',1],[42,26,'decal:decal-07-red-leaf-cluster',1],[27,8,'gen:drift-3',.9],[44,10,'town:leaf_drift',1]],W('the hens have scratched the grass bare round the coop; maple leaves at the back','a believable worn patch around the animals'));

 // ---------------------------------------------------------------- the street edges: gutter leaves (the owner packs leaves at the curbs)
 P.section('Curbs');
 gutter(P,fit,'S',[6,9.5,21,30,33,44,57.5,61],W('autumn leaves washed into the gutter along Maple Lane','warm clumps at the curb line; packed in places, thin in others'),{seed:5});
 gutter(P,fit,'E',[12,27,30,44,58],W('leaves in the east gutter','continues the curb litter round the corner'),{seed:6});
 gutter(P,fit,'N',[8,20,37,55],W('leaves along the north curb','the far street gets the same autumn'),{seed:8});
 gutter(P,fit,'W',[10,26,45,60],W('leaves along the west curb under the pines','keeps the corner from looking swept'),{seed:9});
 return P.done();
}
