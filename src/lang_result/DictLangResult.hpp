#ifndef DICTLANGRESULT_H
#define DICTLANGRESULT_H
#pragma once

#include "LangResult.hpp"

class DictLangResult : public virtual LangResult {
  using LangResult::LangResult;

private:
  pkvlist _dict = nullptr;

public:
  DictLangResult(shared_ptr<IGeneratorMeta> meta, pkvlist dict);
  virtual pkvlist result() override;
};
#endif