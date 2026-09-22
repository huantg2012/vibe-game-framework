import type { ChamberPixels } from './purification-chamber-pixels';
import { CHAMBER_PALETTE as c, horizontal, upright, materialFace } from './chamber-pixel-helpers';

/** Exterior is a displaced cast structure, with coarse volume kept behind the working room. */
export function paintChamberExterior(p: ChamberPixels): void {
  p.setPlane(null);
  p.rect(0, 0, 640, 400, c.void);
  // Far displaced floor: a single broad underface, its broken edge, then missing space.
  horizontal(p, 48, .70);
  materialFace(p, [[0,47],[80,20],[172,12],[235,29],[216,47],[161,43],[122,56],[62,96],[0,112]],
    [c.black,c.shadow,c.black], 31, 55, 25);
  upright(p, 112, 28, [0, 1, 0], .68, -.35);
  p.poly([[0,94],[61,78],[117,48],[161,38],[210,43],[206,51],[161,48],[122,60],[67,96],[0,121]],c.black);
  p.poly([[0,118],[54,100],[45,122],[17,144],[0,147]],c.shadow);
  horizontal(p, 76, .68);
  p.poly([[299,19],[353,36],[386,35],[429,62],[420,76],[385,60],[350,59],[305,36]],c.black);
  upright(p, 65, 51, [0, 1, 0], .64, .28, 350);
  p.poly([[304,35],[349,59],[385,60],[417,75],[409,82],[379,69],[348,67],[308,45]],c.shadow);
  upright(p, 103, 18, [-.8, .6, 0], .66);
  materialFace(p, [[474,14],[501,18],[530,59],[592,48],[640,62],[640,121],[592,98],[557,103],[528,121],[502,89]],
    [c.black,c.shadow,c.black], 43, 43, 18);
  horizontal(p, 80, .75);
  p.poly([[532,64],[591,54],[640,70],[640,80],[591,65],[536,75]],c.recess);
  horizontal(p, -30, .65);
  p.poly([[0,355],[79,333],[166,364],[272,376],[329,361],[410,379],[478,354],[541,359],[640,324],[640,376],[560,399],[398,400],[307,390],[176,399],[74,365],[0,388]],c.black);
  p.setPlane(null);
  p.poly([[4,363],[73,346],[118,362],[101,367],[70,359],[0,379]],c.shadow);
  p.poly([[210,384],[271,383],[291,392],[244,398]],c.shadow);

  // West: one severed wall mass. Its short upper pocket ends above a solid
  // lower slab; the slab must retain broad material even with all teal ignored.
  upright(p, 281, -4, [.65, .76, 0], .80, -.65 / .76);
  p.poly([[0,145],[31,119],[61,126],[77,170],[78,215],[64,247],[42,280],[13,290],[0,281]],c.concrete);
  horizontal(p, 130, .86);
  p.poly([[0,145],[31,119],[61,126],[69,144],[40,136],[17,154],[0,170]],c.concrete);
  p.setPlane(null);
  // A retained skin has one broken end, not a second outline around the cap.
  p.poly([[0,145],[29,123],[44,125],[42,132],[29,137],[20,149],[8,154],[0,160]],c.plaster);
  p.poly([[44,125],[56,127],[61,136],[49,134],[42,139],[35,138],[42,132]],c.oldPlaster);
  p.poly([[51,132],[57,133],[60,137],[54,137]],c.plane);

  // The upper opening is blind: its floor closes here instead of continuing
  // down to the foot and turning the entire remaining body into a bent strip.
  upright(p, 207, 43, [0, 1, 0], .34);
  p.poly([[17,160],[37,143],[48,149],[53,164],[49,187],[39,207],[24,203],[17,184]],c.black);
  upright(p, 207, 43, [.65, .76, 0], .47, -.65 / .76, 17);
  p.poly([[17,160],[27,151],[32,153],[27,169],[29,190],[36,198],[39,207],[24,203],[17,184]],c.shadow);
  upright(p, 207, 43, [-.8, .6, 0], .50, .8 / .6, 43);
  p.poly([[43,149],[48,149],[53,164],[49,187],[40,199],[41,188],[45,170]],c.recess);
  horizontal(p, 43, .49);
  p.poly([[29,194],[41,188],[45,193],[39,207],[27,202]],c.shadow);

  // A 20–28px transverse thickness survives across this inclined lower face.
  // Height is one affine plane; retained plaster and aggregate only change albedo.
  p.setPlane({ normal: [-.40, .32, .68], elevation: 10, originX: 15, originY: 280,
    riseX: .40, riseY: -.32, occlusion: .84, roughness: .98 });
  p.poly([[0,256],[15,240],[35,225],[55,217],[68,221],[65,238],[49,264],[32,282],[15,287],[0,279]],c.concrete);
  p.setPlane(null);
  p.poly([[4,257],[16,242],[32,231],[45,228],[47,236],[39,244],[43,247],[32,259],[29,273],[17,281],[5,273]],c.plaster);
  p.poly([[29,273],[32,259],[43,247],[39,244],[47,236],[48,242],[44,250],[35,261],[32,274],[18,283],[17,281]],c.oldPlaster);
  p.poly([[49,231],[56,227],[60,231],[55,237]],c.plane);
  p.poly([[44,254],[49,248],[52,249],[49,255]],c.recess);
  p.poly([[17,258],[24,250],[27,251],[23,256],[20,262]],c.plane);
  upright(p, 281, -4, [.7, .714, 0], .76, -.7 / .714, 42);
  p.poly([[49,264],[65,238],[68,221],[75,212],[77,217],[64,247],[42,280],[32,282]],c.concrete);
  upright(p, 287, 0, [0, 1, 0], .79);
  p.poly([[0,273],[14,282],[30,277],[32,282],[15,287],[0,279]],c.concrete);

  // The transverse fracture overlaps the head of the slab. Its wide broken
  // end carries a different material, not an equal-width chain of joints.
  horizontal(p, 68, .83);
  p.poly([[0,191],[14,181],[28,192],[49,196],[52,206],[34,215],[12,204],[0,211]],c.concrete);
  p.setPlane(null);
  p.poly([[0,194],[12,185],[17,188],[15,193],[23,198],[19,200],[11,197],[0,204]],c.plaster);
  p.poly([[31,198],[39,199],[42,204],[37,207],[31,204]],c.earth);
  upright(p, 229, 46, [0, 1, 0], .77);
  p.poly([[0,211],[12,204],[34,215],[52,206],[49,221],[31,229],[10,218],[0,223]],c.recess);
  p.setPlane(null);
  p.poly([[33,216],[44,212],[47,215],[41,222],[33,224]],c.concrete);
  // The rewritten face repeats a fragment, then presses into the west boundary at (99,240).
  p.poly([[48,135],[61,139],[57,160],[71,179],[65,193],[68,207],[85,218],[94,236],[88,242],[77,223],[59,214],[57,191],[60,178],[47,159]],c.deep);
  p.poly([[53,148],[57,148],[53,162],[66,181],[62,188],[61,177],[50,162]],c.teal);
  p.poly([[63,201],[66,207],[84,217],[89,229],[84,226],[80,221],[61,214]],c.teal);
  p.poly([[38,227],[42,227],[50,219],[49,226],[42,234],[35,235]],c.shadow);

  // East: one thick enclosure, unlike the west slab. The 26px rear wall stays
  // continuous through the middle; only its upper end contains a deep opening.
  upright(p, 291, -3, [-.65, .76, 0], .82, .65 / .76, 614);
  p.poly([[593,121],[621,114],[640,124],[640,301],[616,286],[597,254],[578,211],[583,156]],c.concrete);
  upright(p, 291, -3, [0, 1, 0], .89);
  p.poly([[614,134],[640,140],[640,286],[625,282],[614,256],[612,207]],c.plane);
  p.setPlane(null);
  // Most of this old skin is intact. The sparse exposed binder only follows
  // the one torn lower end, leaving the tall material area calm and weighty.
  p.poly([[623,152],[640,155],[640,248],[632,250],[621,232],[623,219],[618,205],[620,186]],c.plaster);
  p.poly([[623,219],[621,232],[632,250],[640,248],[640,255],[631,257],[619,235],[620,221],[616,207],[618,205]],c.oldPlaster);
  p.poly([[625,168],[633,167],[635,173],[629,176],[625,173]],c.concrete);
  p.poly([[634,229],[640,232],[640,240],[636,238]],c.earth);
  horizontal(p, 141, .82);
  p.poly([[583,156],[593,121],[621,114],[640,124],[640,140],[620,131],[604,137],[595,164]],c.concrete);
  p.setPlane(null);
  p.poly([[593,126],[607,122],[614,124],[609,129],[599,133],[596,143],[590,146]],c.plaster);
  p.poly([[620,119],[628,121],[634,126],[623,124]],c.plane);

  upright(p, 199, 44, [0, 1, 0], .30);
  p.poly([[592,157],[605,144],[618,145],[622,155],[619,181],[610,197],[599,195],[592,182]],c.black);
  upright(p, 199, 44, [.65, .76, 0], .43, -.65 / .76, 598);
  p.poly([[592,157],[601,148],[607,150],[603,163],[603,181],[610,185],[610,197],[599,195],[592,182]],c.shadow);
  upright(p, 199, 44, [-.8, .6, 0], .48, .8 / .6, 614);
  p.poly([[614,149],[618,151],[618,177],[610,190],[607,183],[612,171],[612,157]],c.recess);
  // The front lip hides the cavity floor, then turns into a complete thick
  // section. No second long black opening cuts through the wall below it.
  horizontal(p, 66, .77);
  p.poly([[598,194],[608,188],[622,193],[640,191],[640,207],[626,209],[615,221],[600,210]],c.concrete);
  p.setPlane(null);
  p.poly([[602,195],[608,192],[613,196],[610,201],[604,201]],c.plane);
  upright(p, 233, 40, [0, 1, 0], .76);
  p.poly([[600,210],[615,221],[626,209],[640,207],[640,222],[628,222],[618,233],[604,223]],c.concrete);
  p.setPlane(null);
  p.poly([[621,220],[626,215],[633,215],[637,220],[629,225],[624,224]],c.earth);

  p.setPlane({ normal: [-.20, .45, .55], elevation: 5, originX: 617, originY: 285,
    riseX: .20, riseY: -.45, occlusion: .79, roughness: .98 });
  p.poly([[583,215],[598,220],[611,238],[628,240],[640,252],[640,279],[627,276],[617,285],[603,267],[591,246]],c.ash);
  p.setPlane(null);
  p.poly([[601,240],[611,245],[617,245],[620,251],[631,254],[634,263],[625,267],[614,260],[608,260]],c.concrete);
  p.poly([[617,250],[624,252],[626,256],[620,258],[616,255]],c.plane);
  p.poly([[607,253],[611,255],[613,260],[609,258]],c.oldPlaster);
  upright(p, 286, -3, [0, 1, 0], .70);
  p.poly([[605,266],[617,276],[627,269],[640,274],[640,283],[625,279],[617,286]],c.recess);
  // Mismatched repeated joint is caught by the east shell. Its endpoint matches the repair.
  p.poly([[599,179],[605,185],[590,202],[579,206],[573,224],[556,231],[550,228],[561,221],[568,219],[573,201],[586,195]],c.deep);
  p.poly([[596,187],[599,186],[590,198],[580,203],[576,217],[573,218],[577,201],[587,195]],c.teal);
  p.poly([[583,235],[588,238],[597,260],[594,259]],c.deep);
  // Secondary top intrusion has a heavy, fractured stem aligned to the repaired seam.
  upright(p, 109, 44, [0, 1, 0], .74);
  materialFace(p, [[274,19],[287,15],[315,40],[313,64],[323,83],[325,105],[314,109],[308,87],[293,71],[296,46],[280,35]],
    [c.black,c.shadow,c.recess], 139, 9, 18);
  upright(p, 109, 44, [1, 0, 0], .70);
  p.poly([[287,15],[297,20],[321,43],[320,65],[329,82],[326,105],[320,101],[320,84],[309,66],[311,42]],c.recess);
  upright(p, 109, 37, [-1, 0, 0], .42);
  p.poly([[300,47],[305,46],[303,64],[315,82],[313,86],[298,69]],c.black);
  p.setPlane(null);
  p.poly([[315,87],[319,89],[320,105],[315,103]],c.deep);
  p.rect(317,96,1,5,c.teal);

  // Near cut fragments below the foundation: mineral faces end into depth and black gaps.
  upright(p, 400, -42, [0, 1, 0], .67);
  materialFace(p, [[430,375],[479,350],[507,356],[515,373],[551,373],[573,356],[607,367],[578,389],[512,400],[472,388]],
    [c.black,c.shadow,c.recess], 155, 26, 9);
  horizontal(p, -19, .80);
  p.poly([[439,374],[479,355],[504,360],[499,369],[473,365],[450,381]],c.recess);
  p.setPlane(null);
  p.poly([[454,373],[478,362],[489,363],[488,366],[477,366],[459,375]],c.concrete);
  p.poly([[514,381],[543,378],[551,382],[531,391],[518,390]],c.black);
  horizontal(p, -21, .76);
  p.poly([[558,375],[575,362],[589,369],[576,378]],c.recess);
  p.setPlane(null);
  p.line(577,366,583,369,c.concrete);
}
