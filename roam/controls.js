import * as THREE from 'three'

const _v3 = new THREE.Vector3()
const _v1 = new THREE.Vector3()
const EPSILON = 1e-5;

function smoothDamp(
  current,
  target,
  currentVelocityRef,
  smoothTime,
  maxSpeed = Infinity,
  deltaTime,
) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;

  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTo = target;

  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, - maxChange, maxChange);
  target = current - change;

  const temp = (currentVelocityRef.value + omega * change) * deltaTime;
  currentVelocityRef.value = (currentVelocityRef.value - omega * temp) * exp;
  let output = target + (change + temp) * exp;

  if (originalTo - current > 0.0 === output > originalTo) {

    output = originalTo;
    currentVelocityRef.value = (output - originalTo) / deltaTime;

  }

  return output;
}

/**
* 向量平滑阻尼函数
* 参考Unity中的Vector3.SmoothDamp
* https://docs.unity3d.com/ScriptReference/Vector3.SmoothDamp.html
* 源码位置
* https://github.com/Unity-Technologies/UnityCsReference/blob/master/Runtime/Export/Math/Mathf.cs
*
* @param current 当前向量
* @param target 目标向量
* @param currentVelocityRef 当前速度引用
* @param smoothTime 平滑时间
* @param maxSpeed 最大速度，默认为Infinity
* @param deltaTime 时间差
* @param out 输出向量
* @returns 平滑后的向量
*/
function smoothDampVec3(
  current,
  target,
  currentVelocityRef,
  smoothTime,
  maxSpeed = Infinity,
  deltaTime,
  out
) {

  // Based on Game Programming Gems 4 Chapter 1.10
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;

  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  let targetX = target.x;
  let targetY = target.y;
  let targetZ = target.z;

  let changeX = current.x - targetX;
  let changeY = current.y - targetY;
  let changeZ = current.z - targetZ;

  const originalToX = targetX;
  const originalToY = targetY;
  const originalToZ = targetZ;

  // Clamp maximum speed
  const maxChange = maxSpeed * smoothTime;

  const maxChangeSq = maxChange * maxChange;
  const magnitudeSq = changeX * changeX + changeY * changeY + changeZ * changeZ;

  if (magnitudeSq > maxChangeSq) {

    const magnitude = Math.sqrt(magnitudeSq);
    changeX = changeX / magnitude * maxChange;
    changeY = changeY / magnitude * maxChange;
    changeZ = changeZ / magnitude * maxChange;

  }

  targetX = current.x - changeX;
  targetY = current.y - changeY;
  targetZ = current.z - changeZ;

  const tempX = (currentVelocityRef.x + omega * changeX) * deltaTime;
  const tempY = (currentVelocityRef.y + omega * changeY) * deltaTime;
  const tempZ = (currentVelocityRef.z + omega * changeZ) * deltaTime;

  currentVelocityRef.x = (currentVelocityRef.x - omega * tempX) * exp;
  currentVelocityRef.y = (currentVelocityRef.y - omega * tempY) * exp;
  currentVelocityRef.z = (currentVelocityRef.z - omega * tempZ) * exp;

  out.x = targetX + (changeX + tempX) * exp;
  out.y = targetY + (changeY + tempY) * exp;
  out.z = targetZ + (changeZ + tempZ) * exp;

  // Prevent overshooting
  const origMinusCurrentX = originalToX - current.x;
  const origMinusCurrentY = originalToY - current.y;
  const origMinusCurrentZ = originalToZ - current.z;
  const outMinusOrigX = out.x - originalToX;
  const outMinusOrigY = out.y - originalToY;
  const outMinusOrigZ = out.z - originalToZ;

  if (origMinusCurrentX * outMinusOrigX + origMinusCurrentY * outMinusOrigY + origMinusCurrentZ * outMinusOrigZ > 0) {

    out.x = originalToX;
    out.y = originalToY;
    out.z = originalToZ;

    currentVelocityRef.x = (out.x - originalToX) / deltaTime;
    currentVelocityRef.y = (out.y - originalToY) / deltaTime;
    currentVelocityRef.z = (out.z - originalToZ) / deltaTime;

  }

  return out;

}

/**
 * 判断一个数字是否近似于0
 *
 * @param number 待判断的数字
 * @param error 容差，默认为EPSILON
 * @returns 返回布尔值，表示数字是否近似于0
 */
function approxZero(number, error = EPSILON) {

  return Math.abs(number) < error;

}

/**
 * 将一个数值限制在指定范围内
 *
 * @param value 要限制的数值
 * @param min 最小值
 * @param max 最大值
 * @returns 返回限制后的数值
 */
function clamp(value, min, max) {

  return Math.max(min, Math.min(max, value));

}

/**
 * 判断两个数是否近似相等
 *
 * @param a 第一个数
 * @param b 第二个数
 * @param error 允许的最大误差，默认为EPSILON
 * @returns 如果两个数近似相等，则返回true；否则返回false
 */
function approxEquals(a, b, error = EPSILON) {

  return approxZero(a - b, error);

}

class FirstPersonControls {
  get enable() {
    return this._enable;
  }

  set enable(value) {
    this._enable = value
  }

  constructor(camera, renderer) {
    this.camera = camera;
    this.renderer = renderer;
    this._domElement = renderer.domElement;
    this.activePointer = null
    this._enable = true;

    this.keyResponse = {
      forward: false,
      back: false,
      left: false,
      right: false,
      up: false,
      down: false
    }

    this._thetaVelocity = { value: 0 }
    this._phiVelocity = { value: 0 }
    this._moveVelocity = new THREE.Vector3(0, 0, 0)
    this._needsUpdate = true;
    this.rotationSpeed = 1;

    this.moveSpeed = 0.1;

    this._move = new THREE.Vector3()
    this._upVec = new THREE.Vector3(0, 1, 0)

    this._rotation = new THREE.Vector3(0, 0, -1).applyNormalMatrix(new THREE.Matrix3().setFromMatrix4(this.camera.matrixWorld))

    this._target = new THREE.Vector3()
    this._target.copy(this.camera.position)

    this._targetEnd = new THREE.Vector3();
    this._targetEnd.copy(this._target)

    this._spherical = new THREE.Spherical()
    this._spherical.setFromVector3(this._rotation)

    this._sphericalEnd = new THREE.Spherical()
    this._sphericalEnd.copy(this._spherical)

    this._domElement.addEventListener('pointerdown', this.pointerDown.bind(this))
    this._domElement.addEventListener('pointermove', this.pointerMove.bind(this))
    this._domElement.addEventListener('pointerup', this.pointerUp.bind(this))
    this._domElement.addEventListener('keydown', this.keyDown.bind(this))
    this._domElement.addEventListener('keyup', this.keyUp.bind(this))
  }

  keyDown(cb) {
    if (!this.enable) return
    switch (cb.code) {
      case "KeyW":
        this.keyResponse.forward = true;
        break;
      case "KeyS":
        this.keyResponse.back = true;
        break;
      case "KeyA":
        this.keyResponse.left = true;
        break;
      case "KeyD":
        this.keyResponse.right = true;
        break;
      case "KeyQ":
      case "Space":
        this.keyResponse.up = true;
        break;
      case "KeyE":
        this.keyResponse.down = true;
        break;
      default:
        break;
    }
  }

  keyUp(cb) {
    if (!this.enable) return
    switch (cb.code) {
      case "KeyW":
        this.keyResponse.forward = false;
        break;
      case "KeyS":
        this.keyResponse.back = false;
        break;
      case "KeyA":
        this.keyResponse.left = false;
        break;
      case "KeyD":
        this.keyResponse.right = false;
        break;
      case "KeyQ":
      case "Space":
        this.keyResponse.up = false;
        break;
      case "KeyE":
        this.keyResponse.down = false;
        break;
      default:
        break;
    }
  }

  pointerDown(e) {
    if (!this.enable) return
    this.activePointer = {
      id: e.pointerId,
      x: e.offsetX,
      y: e.offsetY
    }
  }

  pointerMove(e) {
    if (!this.enable || !this.activePointer) return

    const offsetX = ((e.offsetX - this.activePointer.x) / this._domElement.width) * 2;
    const offsetY = ((e.offsetY - this.activePointer.y) / this._domElement.height) * 2;

    this.activePointer.x = e.offsetX;
    this.activePointer.y = e.offsetY;

    this._sphericalEnd.theta -= offsetX * this.rotationSpeed
    this._sphericalEnd.phi += offsetY * this.rotationSpeed
    this._sphericalEnd.makeSafe()

  }

  pointerUp() {
    this.activePointer = null
  }

  move() {
    this._move.set(0, 0, 0)

    if (this.keyResponse.forward) this._move.z -= 1
    if (this.keyResponse.back) this._move.z += 1
    if (this.keyResponse.left) this._move.x -= 1
    if (this.keyResponse.right) this._move.x += 1
    if (this.keyResponse.up) this._move.y += 1
    if (this.keyResponse.down) this._move.y -= 1

    this._move.normalize()
  }

  update(time) {
    const deletaTheta = this._sphericalEnd.theta - this._spherical.theta;
    const deletaPhi = this._sphericalEnd.phi - this._spherical.phi;

    this.move()

    const forward = this._move.clone().applyQuaternion(this.camera.quaternion);

    forward.cross(this._upVec).cross(this._upVec).negate();
    forward.normalize()

    const position = this.camera.position.clone();
    const targetPosition = position.add(forward.multiplyScalar(this.moveSpeed))
    this._targetEnd.copy(targetPosition)

    if (approxEquals(this._target.x, this._targetEnd.x) &&
      approxEquals(this._target.y, this._targetEnd.y) &&
      approxEquals(this._target.z, this._targetEnd.z)) {
      this._moveVelocity = new THREE.Vector3(0, 0, 0)
      this._target.copy(this._targetEnd)
    } else {
      this._needsUpdate = true;
      smoothDampVec3(position, targetPosition, this._moveVelocity, 0.25, Infinity, time, this._target);
    }

    if (approxZero(deletaTheta)) {
      this._thetaVelocity = { value: 0 }
      this._spherical.theta = this._sphericalEnd.theta;
    } else {
      this._spherical.theta = smoothDamp(this._spherical.theta, this._sphericalEnd.theta, this._thetaVelocity, 0.25, Infinity, time);

      this._needsUpdate = true;
    }

    if (approxZero(deletaPhi)) {
      this._phiVelocity = { value: 0 }
      this._spherical.phi = this._sphericalEnd.phi
    } else {
      this._spherical.phi = smoothDamp(this._spherical.phi, this._sphericalEnd.phi, this._phiVelocity, 0.25, Infinity, time);

      this._needsUpdate = true;
    }

    this.camera.position.copy(this._target);
    this.camera.updateProjectionMatrix();

    _v1.copy(this.camera.position)
    this._spherical.makeSafe();
    this.camera.position.set(0, 0, 0)

    _v3.setFromSpherical(this._spherical)
    this.camera.lookAt(_v3)
    this.camera.position.copy(_v1)
  }

  updateCamera(camera) {
    this.camera = camera
  }

  type() {
    return 'navigation'
  }

  dispose() {
    if (this.events != null) {
      for (let i = 0; i < this.events.length; i++) this.events[i].unregister();
      this.events = null;
    }

    this._domElement.removeEventListener('pointerdown', this.pointerDown.bind(this))
    this._domElement.removeEventListener('pointermove', this.pointerMove.bind(this))
    this._domElement.removeEventListener('pointerup', this.pointerUp.bind(this))
    this._domElement.removeEventListener('keydown', this.keyDown.bind(this))
    this._domElement.removeEventListener('keyup', this.keyUp.bind(this))
  }
}

export { FirstPersonControls }