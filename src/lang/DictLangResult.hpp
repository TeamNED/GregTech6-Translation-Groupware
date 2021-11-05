#ifndef DICTLANGRESULT_H
#define DICTLANGRESULT_H
#pragma once

#include "LangResult.hpp"

class DictLangResult : public LangResult {
  using LangResult::LangResult;

private:
  LangListPointer _dict = nullptr;

public:
  DictLangResult(shared_ptr<IGeneratorMeta> meta, LangListPointer dict);
  virtual LangListPointer result() override;
};
#endif