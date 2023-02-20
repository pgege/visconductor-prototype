import {
  drawCircle,
  drawLine,
  drawRect,
  ForeshadowingAreaSubjectType,
  startTimeoutInstance,
} from "@/utils";
import {
  calculateDistance,
  containsValueLargerThanMax,
} from "../../calculations";
import {
  distanceBetweenPoints,
  type Coordinate2D,
  type Dimensions,
} from "../../chart";
import { HANDS } from "./gesture-utils";
import {
  GestureListener,
  type GestureListenerConstructorArgs,
  type ListenerProcessedFingerData,
} from "./GestureListener";
import { SupportedGestures } from "./handGestures";
import { LinearPlaybackGestureListener } from "./LinearPlaybackGestureListener";

export type ForeshadowingGestureListenerConstructorArgs =
  GestureListenerConstructorArgs;

export type ForeshadowingAreaData =
  | {
      position: Coordinate2D;
      dimensions: Dimensions;
      radius?: number;
    }
  | {
      position: Coordinate2D;
      radius: number;
      dimensions?: Dimensions;
    };

export enum ForeshadowingType {
  SHAPE = "shape",
  RANGE = "range",
}

export enum ForeshadowingShapes {
  RECTANGLE = "rectangle",
  CIRCLE = "circle",
  RANGE = "range",
}

export interface ForeshadowingRangePosition {
  leftFingerPosition: Coordinate2D;
  rightFingerPosition: Coordinate2D;
}

export interface ForeshadowingShapePosition {
  leftIndex: Coordinate2D;
  leftThumb: Coordinate2D;
  rightIndex: Coordinate2D;
  rightThumb: Coordinate2D;
}

export class ForeshadowingGestureListener extends GestureListener {
  static playbackSubjectKey = "playbackSubject";
  static foreshadowingAreaSubjectKey = "foreshadowingAreaSubject";

  private initialShapePositions: ForeshadowingShapePosition | undefined;
  private recentShapePositions: ForeshadowingShapePosition | undefined;

  private initialRangePositions: ForeshadowingRangePosition | undefined;
  private recentRangePositions: ForeshadowingRangePosition | undefined;

  private currentShape: ForeshadowingShapes | undefined;
  private rangeSlider: LinearPlaybackGestureListener | undefined;

  constructor({
    position,
    dimensions,
    handsToTrack = {
      dominant: HANDS.RIGHT,
      nonDominant: HANDS.LEFT,
    },
    gestureTypes = [
      {
        rightHand: SupportedGestures.FORESHADOWING_RIGHT_L,
        leftHand: SupportedGestures.FORESHADOWING_LEFT_L,
      },
      {
        rightHand: SupportedGestures.FORESHADOWING_RIGHT_C,
        leftHand: SupportedGestures.FORESHADOWING_LEFT_C,
      },
      {
        rightHand: SupportedGestures.OPEN_HAND,
        leftHand: SupportedGestures.OPEN_HAND,
      },
    ],
    gestureSubject,
    canvasDimensions,
    resetKeys,
    subjects,
  }: ForeshadowingGestureListenerConstructorArgs) {
    super({
      position,
      dimensions,
      handsToTrack,
      gestureSubject,
      canvasDimensions,
      resetKeys,
      subjects,
    });

    this.gestureTypes = gestureTypes;
  }

  private verifyGesturesMatch({
    left,
    right,
  }: {
    left: SupportedGestures;
    right: SupportedGestures;
  }) {
    let match = false;
    let type = undefined;
    if (left === SupportedGestures.FORESHADOWING_LEFT_C) {
      match = right === SupportedGestures.FORESHADOWING_RIGHT_C;
      type = ForeshadowingType.SHAPE;
    }

    if (left === SupportedGestures.FORESHADOWING_LEFT_L) {
      match = right === SupportedGestures.FORESHADOWING_RIGHT_L;
      type = ForeshadowingType.SHAPE;
    }

    if (left === SupportedGestures.OPEN_HAND) {
      match = right === SupportedGestures.OPEN_HAND;
      type = ForeshadowingType.RANGE;
    }

    return {
      match,
      type,
    };
  }

  private placeListenerInPosition() {
    if (this.recentRangePositions) {
      if (this.rangeSlider) {
        this.rangeSlider.updateState({
          position: {
            x: this.position.x,
            y: Math.min(
              this.recentRangePositions.leftFingerPosition.y,
              this.recentRangePositions.rightFingerPosition.y
            ),
          },
          dimensions: {
            width: this.dimensions.width,
            height: 50,
          },
          emitRange: {
            start: this.recentRangePositions.leftFingerPosition,
            end: this.recentRangePositions.rightFingerPosition,
          },
        });
      } else {
        const playbackSubject = this.getSubjectByKey(
          ForeshadowingGestureListener.playbackSubjectKey
        );

        this.rangeSlider = new LinearPlaybackGestureListener({
          position: {
            x: this.position.x,
            y: Math.min(
              this.recentRangePositions.leftFingerPosition.y,
              this.recentRangePositions.rightFingerPosition.y
            ),
          },
          dimensions: {
            width: this.dimensions.width,
            height: 50,
          },
          gestureSubject: this.gestureSubject,
          canvasDimensions: this.canvasDimensions ?? { width: 0, height: 0 },
          emitRange: {
            start: this.recentRangePositions.leftFingerPosition,
            end: this.recentRangePositions.rightFingerPosition,
          },
          ...(playbackSubject
            ? {
                subjects: {
                  [LinearPlaybackGestureListener.playbackSubjectKey]:
                    playbackSubject,
                },
              }
            : {}),
        });
      }
    }
  }

  private resetRangeGestureState() {
    this.resetTimer();
    this.currentShape = undefined;
    this.initialRangePositions = undefined;
    this.recentRangePositions = undefined;
  }

  private resetRangeSlider() {
    this.rangeSlider?.resetHandler();
  }

  private resetShapeGestureState() {
    this.resetTimer();
    this.currentShape = undefined;
    this.initialShapePositions = undefined;
    this.recentShapePositions = undefined;
  }

  private isCircleShape({
    leftIndex,
    leftThumb,
    rightIndex,
    rightThumb,
  }: ForeshadowingShapePosition) {
    const fingerOneDist = calculateDistance(
      leftIndex as Coordinate2D,
      rightIndex as Coordinate2D
    );

    const fingerTwoDist = calculateDistance(
      leftThumb as Coordinate2D,
      rightThumb as Coordinate2D
    );

    if (
      fingerOneDist.euclideanDistance < 20 &&
      fingerTwoDist.euclideanDistance < 20
    ) {
      return true;
    }

    return false;
  }

  private isRectShape({
    leftIndex,
    leftThumb,
    rightIndex,
    rightThumb,
  }: ForeshadowingShapePosition) {
    const leftThumbRightIndexDist = calculateDistance(
      leftThumb as Coordinate2D,
      rightIndex as Coordinate2D
    );

    const rightThumbLeftIndexDist = calculateDistance(
      rightThumb as Coordinate2D,
      leftIndex as Coordinate2D
    );

    if (
      leftThumbRightIndexDist.euclideanDistance < 20 &&
      rightThumbLeftIndexDist.euclideanDistance < 20
    ) {
      return true;
    }

    return false;
  }

  private renderVisualIndicators(shape: ForeshadowingShapes) {
    if (this.context) {
      const fillStyle = "black";
      const opacity = 0.2;

      this.clearCanvas();

      if (
        shape === ForeshadowingShapes.RECTANGLE &&
        this.recentShapePositions
      ) {
        const rectDimensions = {
          width:
            this.recentShapePositions.rightThumb.x -
            this.recentShapePositions.rightIndex.x,
          height:
            this.recentShapePositions.rightIndex.y -
            this.recentShapePositions.rightThumb.y,
        };
        const rectCoordinates = {
          x: this.recentShapePositions.rightIndex.x,
          y: this.recentShapePositions.rightThumb.y,
        };

        drawRect({
          context: this.context,
          coordinates: rectCoordinates,
          dimensions: rectDimensions,
          fill: true,
          fillStyle,
          opacity,
        });

        const foreshadowingArea = {
          position: rectCoordinates,
          dimensions: rectDimensions,
        };
        this.publishToSubjectIfExists(
          ForeshadowingGestureListener.foreshadowingAreaSubjectKey,
          {
            type: ForeshadowingAreaSubjectType.RECTANGLE,
            value: foreshadowingArea,
          }
        );
      }
      if (shape === ForeshadowingShapes.CIRCLE && this.recentShapePositions) {
        const circleRadius =
          (this.recentShapePositions.rightThumb.y -
            this.recentShapePositions.rightIndex.y) /
          2;
        const circlePosition = {
          x: this.recentShapePositions.rightIndex.x,
          y: this.recentShapePositions.rightIndex.y + circleRadius,
        };
        drawCircle({
          context: this.context,
          radius: circleRadius,
          coordinates: circlePosition,
          fill: true,
          fillStyle,
          opacity,
        });
        const foreshadowingArea = {
          position: circlePosition,
          radius: circleRadius,
        };
        this.publishToSubjectIfExists(
          ForeshadowingGestureListener.foreshadowingAreaSubjectKey,
          {
            type: ForeshadowingAreaSubjectType.CIRCLE,
            value: foreshadowingArea,
          }
        );
      }

      if (shape === ForeshadowingShapes.RANGE && this.recentRangePositions) {
        const lineWidth = 15;
        const startCoordinates = {
          x: this.recentRangePositions.leftFingerPosition.x,
          y: this.recentRangePositions.leftFingerPosition.y,
        };

        const endCoordinates = {
          x: this.recentRangePositions.rightFingerPosition.x,
          y: this.recentRangePositions.rightFingerPosition.y,
        };

        drawLine({
          context: this.context,
          startCoordinates,
          endCoordinates,
          lineWidth,
          strokeStyle: fillStyle,
        });
      }

      this.renderReferencePoints(false);
    }
  }

  private handleRangeGesture(fingerData: ListenerProcessedFingerData) {
    const leftHandData = fingerData[HANDS.LEFT];
    const rightHandData = fingerData[HANDS.RIGHT];

    if (!leftHandData || !rightHandData) {
      return;
    }

    const [leftFingerToTrack] = leftHandData.fingersToTrack;
    const leftFingerPosition = leftHandData.fingerPositions[
      leftFingerToTrack
    ] as Coordinate2D;

    const [rightFingerToTrack] = rightHandData.fingersToTrack;
    const rightFingerPosition = rightHandData.fingerPositions[
      rightFingerToTrack
    ] as Coordinate2D;

    if (
      leftFingerPosition.x === undefined ||
      leftFingerPosition.y === undefined ||
      rightFingerPosition.x === undefined ||
      rightFingerPosition.y === undefined
    ) {
      throw new Error(
        "handleRangeGesture - one of the finger positions is undefined"
      );
    }

    const newRangePosition = {
      leftFingerPosition,
      rightFingerPosition,
    } as ForeshadowingRangePosition;

    const leftFingerInRange = this.isWithinObjectBounds(leftFingerPosition);
    const rightFingerInRange = this.isWithinObjectBounds(rightFingerPosition);

    const canEmit = leftFingerInRange && rightFingerInRange;

    // EMIT NEW TRACKING VALUE
    if (canEmit) {
      if (!this.timer) {
        this.initialRangePositions = newRangePosition;
        this.currentShape = ForeshadowingShapes.RANGE;
        this.timer = startTimeoutInstance({
          onCompletion: () => {
            if (this.initialRangePositions && this.recentRangePositions) {
              const diffs = distanceBetweenPoints(
                Object.values(this.initialRangePositions),
                Object.values(this.recentRangePositions)
              ).map((diff: any) => diff.euclideanDistance);

              if (!containsValueLargerThanMax(diffs, 30)) {
                if (this.context) {
                  if (this.currentShape === ForeshadowingShapes.RANGE) {
                    if (this.currentShape) {
                      this.renderVisualIndicators(this.currentShape);
                      this.placeListenerInPosition();
                    }
                  }

                  this.resetRangeGestureState();
                }
              }
            }
            this.timer = undefined;
          },
          timeout: 1000,
        });
      } else {
        this.recentRangePositions = newRangePosition;
      }
    }
  }

  private handleShapeGesture(fingerData: ListenerProcessedFingerData) {
    const leftHandData = fingerData[HANDS.LEFT];
    const rightHandData = fingerData[HANDS.RIGHT];

    if (!leftHandData || !rightHandData) {
      return;
    }

    const [leftIndexLandmarkId, leftThumbLandmarkId] =
      leftHandData.fingersToTrack;
    const leftIndex = leftHandData.fingerPositions[
      leftIndexLandmarkId
    ] as Coordinate2D;
    const leftThumb = leftHandData.fingerPositions[
      leftThumbLandmarkId
    ] as Coordinate2D;

    const [rightIndexLandmarkId, rightThumbLandmarkId] =
      rightHandData.fingersToTrack;
    const rightIndex = rightHandData.fingerPositions[
      rightIndexLandmarkId
    ] as Coordinate2D;
    const rightThumb = rightHandData.fingerPositions[
      rightThumbLandmarkId
    ] as Coordinate2D;

    if (
      leftIndex.x === undefined ||
      leftIndex.y === undefined ||
      leftThumb.x === undefined ||
      leftThumb.y === undefined ||
      rightIndex.x === undefined ||
      rightIndex.y === undefined ||
      rightThumb.x === undefined ||
      rightThumb.y === undefined
    ) {
      throw new Error(
        "handleShapeGesture - one of the finger positions is undefined"
      );
    }

    const leftIndexInRange = this.isWithinObjectBounds(leftIndex);
    const leftThumbInRange = this.isWithinObjectBounds(leftThumb);
    const rightIndexInRange = this.isWithinObjectBounds(rightIndex);
    const rightThumbInRange = this.isWithinObjectBounds(rightThumb);

    const canEmit =
      leftIndexInRange &&
      leftThumbInRange &&
      rightIndexInRange &&
      rightThumbInRange;

    const newShapePosition = {
      leftIndex,
      leftThumb,
      rightIndex,
      rightThumb,
    } as ForeshadowingShapePosition;
    const isCircle = this.isCircleShape(newShapePosition);
    const isRectangle = this.isRectShape(newShapePosition);

    if (canEmit && (isCircle || isRectangle)) {
      if (!this.timer) {
        this.initialShapePositions = newShapePosition;
        this.currentShape = isCircle
          ? ForeshadowingShapes.CIRCLE
          : isRectangle
          ? ForeshadowingShapes.RECTANGLE
          : undefined;

        this.timer = startTimeoutInstance({
          onCompletion: () => {
            if (this.initialShapePositions && this.recentShapePositions) {
              const diffs = distanceBetweenPoints(
                Object.values(this.initialShapePositions),
                Object.values(this.recentShapePositions)
              ).map((diff) => diff.euclideanDistance);

              if (!containsValueLargerThanMax(diffs, 30)) {
                if (this.currentShape) {
                  this.renderVisualIndicators(this.currentShape);
                }
              }
            }
            this.timer = undefined;
          },
          timeout: 1000,
        });
      } else {
        this.recentShapePositions = newShapePosition;
      }
    }
  }

  private clearAllVisualIndicators() {
    this.renderReferencePoints(true);
    this.publishToSubjectIfExists(
      ForeshadowingGestureListener.foreshadowingAreaSubjectKey,
      {
        type: ForeshadowingAreaSubjectType.CLEAR,
        value: undefined,
      }
    );
  }

  renderReferencePoints(clear = true) {
    if (this.context) {
      if (clear) {
        this.clearCanvas();
      }
      this.renderBorder();
    }
  }

  resetHandler(): void {
    this.resetRangeGestureState();
    this.resetShapeGestureState();
    this.resetRangeSlider();
    this.clearAllVisualIndicators();
  }

  protected handleNewData(fingerData: ListenerProcessedFingerData): void {
    /**
     * NOTE: Don't use this.handsToTrack for emphasis as each hands needs to perform
     * the exact gesture we want so dominant and non dominant hand concept doesn't apply here
     */
    const rightHand = fingerData[HANDS.RIGHT];
    const leftHand = fingerData[HANDS.LEFT];

    if (!rightHand || !leftHand) {
      return;
    }

    const { match, type } = this.verifyGesturesMatch({
      left: leftHand.detectedGesture,
      right: rightHand.detectedGesture,
    });

    if (match) {
      if (type === ForeshadowingType.RANGE) {
        this.handleRangeGesture(fingerData);
      } else if (type === ForeshadowingType.SHAPE) {
        this.handleShapeGesture(fingerData);
      }
    }
  }
}
