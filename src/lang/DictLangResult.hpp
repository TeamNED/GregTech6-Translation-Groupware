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
  LangListPointer &dict();
  const LangListPointer &dict() const;
  virtual LangListPointer result() const override;
};
#endif